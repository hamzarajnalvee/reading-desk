// Turning uploaded files into Docs (blocks of text with page numbers).
// PDF via pdf.js, Word via mammoth, EPUB via JSZip; HTML, Markdown and text are parsed directly.
import type { Block, Doc, DocFormat, DocType } from "../data/types";
import { norm, uid } from "./util";

export class IngestError extends Error {}

const ext = (name: string) => (name.match(/\.([a-z0-9]+)$/i)?.[1] || "").toLowerCase();
const baseName = (name: string) => name.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").trim();

export async function ingestFile(file: File, onProgress?: (msg: string, frac: number) => void): Promise<Doc> {
  const e = ext(file.name);
  if (e === "pdf" || file.type === "application/pdf") return ingestPdf(file, onProgress);
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

function makeDoc(title: string, format: DocFormat, guess: DocType, raw: Omit<Block, "id">[]): Doc {
  const id = uid("doc");
  const blocks = raw.filter((b) => b.text.trim()).map((b, i) => ({ ...b, id: `${id}-b${i + 1}` }));
  if (!blocks.length) throw new IngestError("No readable text was found in this file.");
  const pages = Math.max(...blocks.map((b) => b.page));
  return { id, title: title.slice(0, 300), type: guessType(title, blocks, pages, format, guess), format, pages, blocks, addedAt: Date.now() };
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
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  let pdf;
  try { pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise; }
  catch (e) { throw new IngestError((e as Error).name === "PasswordException" ? "This PDF is password-protected." : "This PDF couldn't be read."); }
  const out: Omit<Block, "id">[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    onProgress?.(`Reading page ${p} of ${pdf.numPages}`, p / pdf.numPages);
    const tc = await (await pdf.getPage(p)).getTextContent();
    let s = "";
    for (const it of tc.items) if ("str" in it) { s += it.str; if (it.hasEOL) s += "\n"; }
    linesToParas(s).forEach((text) => out.push({ kind: looksLikeHeading(text) ? "h" : "p", text, page: p }));
  }
  let title = "";
  try { const m = await pdf.getMetadata(); title = String((m.info as Record<string, unknown>)?.Title || "").trim(); } catch { /* no metadata */ }
  if (title.length < 6 || /^(untitled|microsoft word)/i.test(title)) title = baseName(file.name);
  const doc = makeDoc(title, "pdf", "paper", out);
  doc.hasOriginal = true;
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
  Array.from(opf.getElementsByTagName("item")).forEach((i) => { manifest[i.getAttribute("id") || ""] = i.getAttribute("href") || ""; });
  const spine = Array.from(opf.getElementsByTagName("itemref")).map((i) => i.getAttribute("idref") || "");
  const dir = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1) : "";
  const resolve = (href: string) => {
    const parts: string[] = [];
    (dir + decodeURIComponent(href.split("#")[0])).split("/").forEach((p) => { if (p === "..") parts.pop(); else if (p && p !== ".") parts.push(p); });
    return parts.join("/");
  };
  const out: Omit<Block, "id">[] = [];
  let chapter = 0;
  for (let k = 0; k < spine.length; k++) {
    onProgress?.(`Reading chapter ${k + 1} of ${spine.length}`, k / spine.length);
    const f = zip.file(resolve(manifest[spine[k]] || ""));
    if (!f) continue;
    const paras = htmlParas(new DOMParser().parseFromString(await f.async("string"), "text/html"));
    if (paras.reduce((s, p) => s + p.text.length, 0) < 40) continue;
    chapter++;
    paras.forEach((p) => out.push({ ...p, page: chapter }));
  }
  if (!out.length) throw new IngestError("No readable text was found (the book may be DRM-protected).");
  return makeDoc(title, "epub", "book", out);
}
