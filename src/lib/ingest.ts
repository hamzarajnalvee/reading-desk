// Turning uploaded files into Docs (blocks of text with page numbers).
// PDF via pdf.js, Word via mammoth, EPUB via JSZip; HTML, Markdown and text are parsed directly.
import type { Block, Doc, DocFormat, DocType, OcrLine, TocEntry } from "../data/types";
import { norm, uid } from "./util";
import { loadPdfjs } from "./pdf";
import { ocrParas } from "./pageText";

export class IngestError extends Error {}

const ext = (name: string) => (name.match(/\.([a-z0-9]+)$/i)?.[1] || "").toLowerCase();
const baseName = (name: string) => name.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").trim();

export async function ingestFile(file: File, onProgress?: (msg: string, frac: number) => void): Promise<Doc> {
  const e = ext(file.name);
  if (e === "pdf" || file.type === "application/pdf") {
    const doc = await ingestPdf(file, onProgress);
    // Keep the file itself, so its real pages (figures, tables, layout) can be shown.
    await import("./originals").then((m) => m.keepOriginal(doc.id, file)).catch(() => { doc.hasOriginal = false; });
    return doc;
  }
  if (e === "docx") return ingestDocx(file);
  if (e === "epub") return ingestEpub(file, onProgress);
  if (["html", "htm", "xhtml"].includes(e)) {
    const d = new DOMParser().parseFromString(await file.text(), "text/html");
    const title = norm(d.querySelector("title")?.textContent || "") || baseName(file.name);
    return makeDoc(title, "html", "article", htmlParas(d).map((p) => ({ ...p, page: 1 })));
  }
  if (["doc", "ppt", "pptx", "xls", "xlsx", "pages", "key"].includes(e)) throw new IngestError("This format isn't supported yet. Save it as PDF or .docx.");
  const text = await file.text();
  if (/\u0000/.test(text.slice(0, 2000))) throw new IngestError("This looks like a binary file, not text.");
  const paras = e === "md" || e === "markdown" ? mdParas(text) : textParas(text);
  const h = paras.find((p) => p.kind === "h");
  return makeDoc(e === "md" && h ? h.text : baseName(file.name), e === "md" || e === "markdown" ? "md" : "txt", "article", paginate(paras));
}

export function ingestText(title: string, text: string): Doc {
  return makeDoc(title || norm(text.split("\n")[0]).slice(0, 90), "paste", "article", paginate(textParas(text)));
}

/** A contents entry found while reading a file: `at` is an index into the raw blocks. */
type RawToc = { title: string; level: number; at: number };

function makeDoc(title: string, format: DocFormat, guess: DocType, raw: Omit<Block, "id">[], rawToc: RawToc[] = []): Doc {
  const id = uid("doc");
  const blocks: Block[] = [];
  raw.forEach((b) => { if (b.text.trim()) blocks.push({ ...b, id: `${id}-b${blocks.length + 1}` }); });
  if (!blocks.length) throw new IngestError("No readable text was found in this file.");
  // Empty blocks are dropped, so map each raw index to the next kept block.
  let k = 0;
  const firstKeptFrom: number[] = [];
  raw.forEach((b, i) => { firstKeptFrom[i] = k; if (b.text.trim()) k++; });
  const toc: TocEntry[] = [];
  for (const t of rawToc) {
    const b = blocks[firstKeptFrom[t.at] ?? -1];
    const name = norm(t.title);
    if (b && name) toc.push({ title: name.slice(0, 200), blockId: b.id, level: Math.max(1, t.level) });
  }
  const pages = Math.max(...blocks.map((b) => b.page));
  const doc: Doc = { id, title: title.slice(0, 300), type: guessType(title, blocks, pages, format, guess), format, pages, blocks, addedAt: Date.now() };
  if (toc.length > 1) doc.toc = toc;
  return doc;
}

const key = (s: string) => norm(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
/** The block in [from, to) where a contents entry begins: one whose text starts with the title, else `from`. */
function findStart(raw: Omit<Block, "id">[], title: string, from: number, to: number): number {
  const t = key(title).slice(0, 40);
  if (t.length >= 3) for (let i = from; i < to; i++) if (key(raw[i].text).startsWith(t)) return i;
  return from;
}

function guessType(title: string, blocks: Omit<Block, "id">[], pages: number, format: DocFormat, fallback: DocType): DocType {
  const s = (title + " " + blocks.slice(0, 30).map((b) => b.text).join(" ")).toLowerCase();
  if (format === "epub") return "book";
  if (/annual report|form 10-k|integrated report|strategic report|financial statements/.test(s)) return "report";
  if (pages >= 150) return "book";
  if (/\babstract\b|arxiv|doi:|\bet al\.|proceedings|references/.test(s)) return "paper";
  return format === "pdf" ? "paper" : fallback;
}

/* ---------- PDF ---------- */
async function ingestPdf(file: File, onProgress?: (m: string, f: number) => void): Promise<Doc> {
  const pdfjs = await loadPdfjs();
  let pdf;
  try { pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise; }
  catch (e) { throw new IngestError((e as Error).name === "PasswordException" ? "This PDF is password-protected." : "This PDF couldn't be read."); }
  const out: Omit<Block, "id">[] = [];
  const pageStart: number[] = [];
  // Pages with no text layer (a scan, or text drawn as shapes) are read from the page image instead.
  const ocr: Record<number, OcrLine[]> = {};
  try {
    for (let p = 1; p <= pdf.numPages; p++) {
      onProgress?.(`Reading page ${p} of ${pdf.numPages}`, p / pdf.numPages);
      pageStart[p] = out.length;
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      let s = "";
      for (const it of tc.items) if ("str" in it) { s += it.str; if (it.hasEOL) s += "\n"; }
      if (s.replace(/\s/g, "").length >= 20) {
        linesToParas(s).forEach((text) => out.push({ kind: looksLikeHeading(text) ? "h" : "p", text, page: p }));
        continue;
      }
      onProgress?.(`Recognising the words on page ${p} of ${pdf.numPages} (it has no text layer)`, p / pdf.numPages);
      const { recognisePage } = await import("./ocr");
      const lines = await recognisePage(page).catch(() => [] as OcrLine[]);
      if (lines.length) ocr[p] = lines;
      ocrParas(lines).forEach((b) => out.push({ ...b, page: p }));
    }
  } finally {
    if (Object.keys(ocr).length || out.length === 0) await import("./ocr").then((m) => m.endOcr()).catch(() => {});
  }
  pageStart[pdf.numPages + 1] = out.length;
  // The PDF's own bookmarks (its outline) become the contents, each pointing at the page it opens.
  const toc: RawToc[] = [];
  try {
    type Item = { title: string; dest: string | unknown[] | null; items: Item[] };
    const walk = async (items: Item[], level: number) => {
      for (const it of items) {
        if (toc.length >= 2000) return;
        try {
          const dest = typeof it.dest === "string" ? await pdf.getDestination(it.dest) : it.dest;
          const ref = Array.isArray(dest) ? dest[0] : null;
          const index = ref && typeof ref === "object" ? await pdf.getPageIndex(ref as Parameters<typeof pdf.getPageIndex>[0]) : typeof ref === "number" ? ref : -1;
          const p = index + 1;
          if (p >= 1 && p <= pdf.numPages && pageStart[p] < pageStart[p + 1]) toc.push({ title: it.title, level, at: findStart(out, it.title, pageStart[p], pageStart[p + 1]) });
        } catch { /* an entry that points nowhere is skipped */ }
        if (it.items?.length && level < 4) await walk(it.items, level + 1);
      }
    };
    await walk(((await pdf.getOutline()) || []) as Item[], 1);
  } catch { /* no outline */ }
  let title = "";
  try { const m = await pdf.getMetadata(); title = String((m.info as Record<string, unknown>)?.Title || "").trim(); } catch { /* no metadata */ }
  if (title.length < 6 || /^(untitled|microsoft word)/i.test(title)) title = baseName(file.name);
  const doc = makeDoc(title, "pdf", "paper", out, toc);
  doc.hasOriginal = true;
  const recognised = Object.keys(ocr).length;
  if (recognised) {
    doc.ocr = ocr;
    doc.warning = `${recognised === pdf.numPages ? "This PDF's" : `${recognised} of its ${pdf.numPages} pages'`} words were recognised from the page images, so a few may be wrong. Switch to Original to check against the page.`;
  }
  return doc;
}

function looksLikeHeading(t: string) { return t.length < 80 && /^(\d+(\.\d+)*\.?\s+[A-Z]|abstract$|introduction$|conclusions?$|references$)/i.test(t); }

/** Join hard-wrapped PDF lines into paragraphs. */
export function linesToParas(text: string): string[] {
  const lines = text.split("\n").map((s) => s.replace(/\s+/g, " ").trim());
  const lens = lines.filter(Boolean).map((l) => l.length).sort((a, b) => a - b);
  const typical = lens.length ? lens[Math.floor(lens.length * 0.7)] : 80;
  const out: string[] = [];
  let cur = "";
  for (const l of lines) {
    if (!l) { if (cur) { out.push(cur); cur = ""; } continue; }
    cur = cur.endsWith("-") && /^[a-z]/.test(l) ? cur.slice(0, -1) + l : cur ? cur + " " + l : l;
    if (/[.?!:]["”’)]?$/.test(l) && l.length < typical * 0.8) { out.push(cur); cur = ""; }
  }
  if (cur) out.push(cur);
  return out;
}

/* ---------- Text, Markdown, HTML ---------- */
function textParas(t: string): Omit<Block, "id" | "page">[] {
  const parts = t.replace(/\r\n?/g, "\n").split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
  const avg = parts.reduce((s, b) => s + b.length, 0) / (parts.length || 1);
  const paras = avg > 2500 ? linesToParas(t) : parts.map(norm);
  return paras.map((text) => ({ kind: text.length < 80 && /^(chapter|part|section|introduction|preface|appendix)\b/i.test(text) ? "h" : "p", text }));
}
function mdParas(t: string): Omit<Block, "id" | "page">[] {
  const out: Omit<Block, "id" | "page">[] = [];
  for (const chunk of t.replace(/\r\n?/g, "\n").split(/\n{2,}/)) {
    let buf: string[] = [];
    for (const l of chunk.split("\n")) {
      if (/^#{1,6}\s+/.test(l)) { if (buf.length) { out.push({ kind: "p", text: norm(buf.join(" ")) }); buf = []; } out.push({ kind: "h", text: l.replace(/^#+\s+/, "") }); }
      else buf.push(l);
    }
    if (buf.length && norm(buf.join(" "))) out.push({ kind: "p", text: norm(buf.join(" ")) });
  }
  return out;
}
/** A readable web page (from the server's Readability extraction) as a Doc. Links are kept. */
export function docFromHtml(html: string, meta: { title: string; url: string; site?: string; byline?: string; warning?: string }): Doc {
  const d = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const doc = makeDoc(meta.title, "web", "web", paginate(htmlParas(d)));
  return { ...doc, type: "web", url: meta.url, site: meta.site, authors: meta.byline, warning: meta.warning };
}

function linksIn(e: Element, text: string): Block["links"] {
  const out: NonNullable<Block["links"]> = [];
  let from = 0;
  e.querySelectorAll("a[href]").forEach((a) => {
    const href = (a as HTMLAnchorElement).href || a.getAttribute("href") || "";
    const t = norm(a.textContent || "");
    if (!t || !/^https?:\/\//.test(href)) return;
    const i = text.indexOf(t, from);
    if (i < 0) return;
    out.push({ start: i, end: i + t.length, href });
    from = i + t.length;
  });
  return out.length ? out : undefined;
}

function htmlParas(d: Document): Omit<Block, "id" | "page">[] {
  d.querySelectorAll("script,style,noscript,template,iframe,svg,nav,form,button").forEach((e) => e.remove());
  const root = d.querySelector("article") || d.querySelector("main") || d.body;
  const SEL = "h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,figcaption,td,div";
  const out: Omit<Block, "id" | "page">[] = [];
  root?.querySelectorAll(SEL).forEach((e) => {
    if (e.querySelector(SEL)) return;
    const t = norm(e.textContent || "");
    if (!t) return;
    const text = e.tagName === "LI" ? "• " + t : t;
    out.push({ kind: /^H[1-6]$/.test(e.tagName) ? "h" : "p", text, links: linksIn(e, text) });
  });
  return out;
}
/** Give non-paginated text pseudo-pages of ~3,000 characters so citations still work. */
function paginate(paras: Omit<Block, "id" | "page">[]): Omit<Block, "id">[] {
  let page = 1, size = 0;
  return paras.map((p) => { if (size > 3000) { page++; size = 0; } size += p.text.length; return { ...p, page }; });
}

/* ---------- Word ---------- */
async function ingestDocx(file: File): Promise<Doc> {
  const mammoth = (await import("mammoth")).default;
  const { value } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
  const d = new DOMParser().parseFromString(`<body>${value}</body>`, "text/html");
  const paras = htmlParas(d);
  const h = paras.find((p) => p.kind === "h");
  return makeDoc(h?.text || baseName(file.name), "docx", "article", paginate(paras));
}

/* ---------- EPUB ---------- */
async function ingestEpub(file: File, onProgress?: (m: string, f: number) => void): Promise<Doc> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const container = await zip.file("META-INF/container.xml")?.async("string");
  const opfPath = container?.match(/full-path="([^"]+)"/)?.[1];
  if (!opfPath || !zip.file(opfPath)) throw new IngestError("This EPUB's structure couldn't be read.");
  const opf = new DOMParser().parseFromString(await zip.file(opfPath)!.async("string"), "application/xml");
  const dc = "http://purl.org/dc/elements/1.1/";
  const title = norm(opf.getElementsByTagNameNS(dc, "title")[0]?.textContent || "") || baseName(file.name);
  const manifest: Record<string, string> = {};
  const items = Array.from(opf.getElementsByTagName("item"));
  items.forEach((i) => { manifest[i.getAttribute("id") || ""] = i.getAttribute("href") || ""; });
  const spineEl = opf.getElementsByTagName("spine")[0];
  const spine = Array.from(opf.getElementsByTagName("itemref")).map((i) => i.getAttribute("idref") || "");
  const dir = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1) : "";
  const resolve = (href: string) => {
    const parts: string[] = [];
    (dir + decodeURIComponent(href.split("#")[0])).split("/").forEach((p) => { if (p === "..") parts.pop(); else if (p && p !== ".") parts.push(p); });
    return parts.join("/");
  };
  const out: Omit<Block, "id">[] = [];
  /** Where each chapter file's blocks start and end in `out`. */
  const files: Record<string, [number, number]> = {};
  let chapter = 0;
  for (let k = 0; k < spine.length; k++) {
    onProgress?.(`Reading chapter ${k + 1} of ${spine.length}`, k / spine.length);
    const path = resolve(manifest[spine[k]] || "");
    const f = zip.file(path);
    if (!f) continue;
    const paras = htmlParas(new DOMParser().parseFromString(await f.async("string"), "text/html"));
    if (paras.reduce((s, p) => s + p.text.length, 0) < 40) continue;
    chapter++;
    files[path] = [out.length, out.length + paras.length];
    paras.forEach((p) => out.push({ ...p, page: chapter }));
  }
  if (!out.length) throw new IngestError("No readable text was found (the book may be DRM-protected).");

  // The book's own contents: EPUB 3 navigation document, or the older NCX file.
  const nav: { title: string; href: string; level: number; base: string }[] = [];
  const navItem = items.find((i) => (i.getAttribute("properties") || "").split(/\s+/).includes("nav"));
  const ncxItem = items.find((i) => i.getAttribute("id") === spineEl?.getAttribute("toc")) || items.find((i) => i.getAttribute("media-type") === "application/x-dtbncx+xml");
  try {
    if (navItem) {
      const path = resolve(navItem.getAttribute("href") || "");
      const d = new DOMParser().parseFromString(await zip.file(path)!.async("string"), "text/html");
      const navs = Array.from(d.querySelectorAll("nav"));
      const tocNav = navs.find((n) => /\btoc\b/.test(n.getAttribute("epub:type") || n.getAttribute("type") || n.getAttribute("role") || "")) || navs[0];
      const walk = (ol: Element | null, level: number) => {
        Array.from(ol?.children || []).forEach((li) => {
          if (li.tagName !== "LI") return;
          const a = li.querySelector(":scope > a, :scope > span");
          const href = a?.getAttribute("href");
          if (a && href) nav.push({ title: a.textContent || "", href, level, base: path });
          walk(li.querySelector(":scope > ol"), level + 1);
        });
      };
      walk(tocNav?.querySelector("ol") || null, 1);
    }
    if (!nav.length && ncxItem) {
      const path = resolve(ncxItem.getAttribute("href") || "");
      const d = new DOMParser().parseFromString(await zip.file(path)!.async("string"), "application/xml");
      const walk = (parent: Element, level: number) => {
        Array.from(parent.children).forEach((p) => {
          if (p.localName !== "navPoint") return;
          const label = p.getElementsByTagName("text")[0]?.textContent || "";
          const src = p.getElementsByTagName("content")[0]?.getAttribute("src");
          if (src) nav.push({ title: label, href: src, level, base: path });
          walk(p, level + 1);
        });
      };
      const map = d.getElementsByTagName("navMap")[0];
      if (map) walk(map, 1);
    }
  } catch { /* contents couldn't be read; the book still opens */ }
  const toc: RawToc[] = [];
  for (const n of nav) {
    // Links in the navigation file are relative to that file, not to the package.
    const baseDir = n.base.includes("/") ? n.base.slice(0, n.base.lastIndexOf("/") + 1) : "";
    const parts: string[] = [];
    (baseDir + decodeURIComponent(n.href.split("#")[0])).split("/").forEach((p) => { if (p === "..") parts.pop(); else if (p && p !== ".") parts.push(p); });
    const range = files[parts.join("/")];
    if (!range) continue;
    toc.push({ title: n.title, level: Math.min(n.level, 4), at: n.href.includes("#") ? findStart(out, n.title, range[0], range[1]) : range[0] });
  }
  return makeDoc(title, "epub", "book", out, toc);
}
