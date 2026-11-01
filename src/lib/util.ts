export const uid = (prefix = "id") => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
export const norm = (s: string) => s.replace(/\s+/g, " ").trim();
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

export function timeAgo(t: number, now = Date.now()): string {
  const m = Math.round((now - t) / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d} days ago`;
  return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function hostOf(url?: string): string {
  if (!url) return "";
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

/** Split text into sentence ranges [start, end). */
export function sentences(text: string): [number, number][] {
  const out: [number, number][] = [];
  const re = /[^.!?]+(?:[.!?]+["”’)]?|$)\s*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) && m[0]) {
    const lead = m[0].length - m[0].trimStart().length;
    const s = m.index + lead, e = m.index + m[0].trimEnd().length;
    if (e > s) out.push([s, e]);
    if (re.lastIndex >= text.length) break;
  }
  return out.length ? out : [[0, text.length]];
}

export function sentenceAt(text: string, offset: number): [number, number] {
  return sentences(text).find(([s, e]) => offset >= s && offset <= e) || [0, text.length];
}

/** Very small Markdown renderer for notes and AI answers. Escapes HTML first. */
export function md(src: string): string {
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
  const inline = (s: string) => {
    const keep: string[] = [];
    const hold = (html: string) => `\u0000${keep.push(html) - 1}\u0000`;
    return s
      .replace(/`([^`]+)`/g, (_, c) => hold(`<code>${c}</code>`))
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, t, u) => hold(`<a href="${u}" target="_blank" rel="noopener">${t}</a>`))
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
      .replace(/(^|[\s(])_([^_\s][^_]*)_(?=[\s).,;:!?]|$)/g, "$1<em>$2</em>")
      .replace(/\u0000(\d+)\u0000/g, (_, i) => keep[Number(i)]);
  };
  const lines = esc(src || "").split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (/^#{1,4}\s/.test(l)) { out.push(`<h4>${inline(l.replace(/^#+\s/, ""))}</h4>`); i++; continue; }
    if (/^\s*[-*•]\s+/.test(l)) { const b: string[] = []; while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) b.push(`<li>${inline(lines[i++].replace(/^\s*[-*•]\s+/, ""))}</li>`); out.push(`<ul>${b.join("")}</ul>`); continue; }
    if (/^\s*\d+[.)]\s+/.test(l)) { const b: string[] = []; while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) b.push(`<li>${inline(lines[i++].replace(/^\s*\d+[.)]\s+/, ""))}</li>`); out.push(`<ol>${b.join("")}</ol>`); continue; }
    if (/^&gt;\s?/.test(l)) { const b: string[] = []; while (i < lines.length && /^&gt;\s?/.test(lines[i])) b.push(inline(lines[i++].replace(/^&gt;\s?/, ""))); out.push(`<blockquote>${b.join("<br>")}</blockquote>`); continue; }
    if (!l.trim()) { i++; continue; }
    const b: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|\s*[-*•]\s+|\s*\d+[.)]\s+|&gt;)/.test(lines[i])) b.push(lines[i++]);
    if (!b.length) b.push(lines[i++]);
    out.push(`<p>${b.map(inline).join("<br>")}</p>`);
  }
  return out.join("");
}
