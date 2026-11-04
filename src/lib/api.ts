// Browser-side calls to the local API server (server/index.ts). The API key never reaches the browser.
import type { Doc, Source } from "../data/types";
import { docFromHtml, ingestFile, IngestError } from "./ingest";
import { authHeader } from "./supabase";

async function streamInto(res: Response, onText: (full: string) => void): Promise<string> {
  if (!res.ok) {
    const j = (res.headers.get("content-type") || "").includes("json") ? await res.json().catch(() => null) : null;
    throw new Error(j?.error || `Request failed (${res.status})`);
  }
  if (!res.body) { const t = await res.text(); onText(t); return t; }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let full = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    full += dec.decode(value, { stream: true });
    onText(full);
  }
  return full;
}
/** Claude calls carry the Supabase session token when signed in, so a hosted server can check who is asking. */
const post = async (path: string, body: unknown, signal?: AbortSignal) =>
  fetch(path, { method: "POST", headers: { "Content-Type": "application/json", ...(await authHeader()) }, body: JSON.stringify(body), signal });

export async function ask(o: { title: string; context: string; messages: { role: "user" | "assistant"; content: string }[]; signal?: AbortSignal; onText: (t: string) => void }) {
  return streamInto(await post("/api/ask", { title: o.title, context: o.context, messages: o.messages }, o.signal), o.onText);
}
export async function explain(o: { passage: string; context: string; title: string; depth: string; signal?: AbortSignal; onText: (t: string) => void }) {
  return streamInto(await post("/api/explain", o, o.signal), o.onText);
}
export async function summarise(o: { title: string; material: string; signal?: AbortSignal; onText: (t: string) => void }) {
  return streamInto(await post("/api/summarise", o, o.signal), o.onText);
}

/** Dictionary definition (Wiktionary / Wikipedia). Null when nothing was found. */
export async function defineTerm(term: string): Promise<{ term: string; text: string; source: Source } | null> {
  try {
    const r = await fetch(`/api/define?term=${encodeURIComponent(term)}`);
    return r.ok ? r.json() : null;
  } catch { return null; }
}

/** Open a web address as a Doc: web pages via Readability, PDFs/EPUBs/text via the normal file readers. */
export async function fetchAsDoc(url: string, onProgress?: (m: string) => void): Promise<Doc> {
  onProgress?.("Opening…");
  let r: Response;
  try { r = await fetch(`/api/fetch?url=${encodeURIComponent(url)}`); }
  catch { throw new IngestError("Couldn't reach the app's server. Is npm run dev running?"); }
  const type = r.headers.get("content-type") || "";
  if (!r.ok) {
    const j = type.includes("json") ? await r.json().catch(() => null) : null;
    throw new IngestError(j?.error || `Couldn't open that address (${r.status}).`);
  }
  if (type.includes("application/json")) {
    const j = await r.json();
    return docFromHtml(j.html, { title: j.title, url: j.url, site: j.site, byline: j.byline, warning: j.warning });
  }
  const name = decodeURIComponent(r.headers.get("X-File-Name") || "download");
  const finalUrl = decodeURIComponent(r.headers.get("X-Final-Url") || url);
  const blob = await r.blob();
  const ext = /\.(pdf|epub|docx|txt|md)$/i.test(name) ? "" : type.includes("pdf") ? ".pdf" : type.includes("epub") ? ".epub" : ".txt";
  const doc = await ingestFile(new File([blob], name + ext, { type: blob.type }), (m) => onProgress?.(m));
  return { ...doc, url: finalUrl, site: new URL(finalUrl).hostname.replace(/^www\./, "") };
}
