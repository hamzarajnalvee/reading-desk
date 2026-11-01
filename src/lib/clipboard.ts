// Reading pasted or dropped text, and working out where it came from.
import type { Source } from "../data/types";
import { hostOf, norm } from "./util";

const SITES: Record<string, string> = {
  "wikipedia.org": "Wikipedia", "google.com": "Google", "scholar.google.com": "Google Scholar", "arxiv.org": "arXiv",
  "nature.com": "Nature", "ft.com": "Financial Times", "bloomberg.com": "Bloomberg", "investopedia.com": "Investopedia",
};

export function siteName(url?: string): string {
  const h = hostOf(url);
  if (!h) return "";
  // Longest match first, so scholar.google.com wins over google.com.
  const hit = Object.keys(SITES).sort((x, y) => y.length - x.length).find((k) => h === k || h.endsWith("." + k));
  if (hit) return SITES[hit];
  const base = h.split(".").slice(-2, -1)[0] || h;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function titleFromUrl(url?: string): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    const last = decodeURIComponent(u.pathname.split("/").filter(Boolean).pop() || "");
    return last.replace(/[_-]+/g, " ").replace(/\.\w+$/, "");
  } catch { return ""; }
}

/**
 * Extract text and (when the browser provides it) the source page.
 * Browsers differ: Windows Chrome includes "SourceURL:" in text/html; Firefox offers text/x-moz-url;
 * a drag from another tab often includes text/uri-list. When none are present, the card asks for a source.
 */
export function readTransfer(dt: DataTransfer): { text: string; source: Source } | null {
  const text = norm(dt.getData("text/plain") || "");
  const html = dt.getData("text/html") || "";
  let url = "";
  const m = html.match(/SourceURL:(\S+)/) || html.match(/<base[^>]+href="([^"]+)"/i);
  if (m) url = m[1];
  if (!url) url = (dt.getData("text/x-moz-url") || "").split("\n")[0];
  if (!url) { const ul = dt.getData("text/uri-list"); if (ul && !ul.startsWith("#")) url = ul.split("\n")[0]; }
  if (!text && url) return { text: url, source: { url, site: siteName(url), title: titleFromUrl(url) } };
  if (!text) return null;
  url = /^https?:\/\//.test(url) ? url.trim() : "";
  return { text: text.slice(0, 4000), source: url ? { url, site: siteName(url), title: titleFromUrl(url) } : {} };
}
