// Links from your writing to passages in the tree. Stored as ordinary Markdown links with a `#cite:` address,
// so the writing stays readable anywhere: [“the quote”](#cite:nodeId/blockId)
import type { MouseEvent } from "react";
import type { Anchor } from "../data/types";

export interface Cite { label: string; nodeId: string; blockId: string }

const RE = /\[([^\]]*)\]\(#cite:([^/\s)]+)\/([^\s)]+)\)/g;

/** A Markdown link to a passage, labelled with (the start of) its quote. */
export function citeLink(a: Anchor): string {
  const q = a.quote.replace(/\s+/g, " ").replace(/[[\]]/g, "").trim();
  const label = q.length > 80 ? q.slice(0, 77).replace(/\s+\S*$/, "") + "…" : q;
  return `[“${label}”](#cite:${a.docId}/${a.blockId})`;
}

/** Every passage link in a piece of writing, in order. */
export function citesIn(text: string): Cite[] {
  return [...(text || "").matchAll(RE)].map((m) => ({ label: m[1], nodeId: m[2], blockId: m[3] }));
}

/** Parse one `#cite:` address, as found in a rendered link. */
export function parseCite(href: string): { nodeId: string; blockId: string } | null {
  const m = href.match(/^#cite:([^/\s]+)\/(\S+)$/);
  return m ? { nodeId: m[1], blockId: m[2] } : null;
}

/** Add a passage link to the end of the writing, on its own line. */
export function appendCite(text: string, a: Anchor): string {
  const t = (text || "").replace(/\s+$/, "");
  return (t ? t + "\n\n" : "") + citeLink(a) + " ";
}

/** A click handler for rendered writing: passage links open the passage instead of following the address. */
export const citeClick = (onOpenPassage: (nodeId: string, blockId: string) => void) => (e: MouseEvent) => {
  const a = (e.target as HTMLElement).closest("a.cite");
  const c = a && parseCite(a.getAttribute("href") || "");
  if (!c) return;
  e.preventDefault();
  onOpenPassage(c.nodeId, c.blockId);
};

/**
 * Add an excerpt to the end of the writing: the words as a quotation, then, in italics, exactly where they came from,
 * linked so a click opens the source at that passage.
 *   > Painting a wall teaches patience.
 *   > — *from [The Dark Side of Optimization](#cite:nodeId/blockId), Little Almanack, p. 2*
 */
export function appendExcerpt(text: string, a: Anchor, from: { title: string; site?: string }): string {
  const t = (text || "").replace(/\s+$/, "");
  return (t ? t + "\n\n" : "") + excerptMarkdown(a, from) + "\n\n";
}

/** The quotation itself, as Markdown, with no space around it. */
export function excerptMarkdown(a: Anchor, from: { title: string; site?: string }): string {
  const quote = a.quote.replace(/\s+/g, " ").trim();
  const title = from.title.replace(/[[\]*_]/g, "").trim() || "Source";
  const where = [from.site?.replace(/[*_]/g, ""), a.page > 0 ? `p. ${a.page}` : ""].filter(Boolean).join(", ");
  return `> ${quote}\n> — *from [${title}](#cite:${a.docId}/${a.blockId})${where ? `, ${where}` : ""}*`;
}

const QUOTE_RE = /^>\s?([\s\S]*?)\n>\s?— \*from \[([^\]]*)\]\(#cite:([^/\s)]+)\/([^\s)]+)\)([^*]*)\*\s*$/;
/**
 * One paragraph of your writing read as a quotation, for showing on the page: the words in quotes, then the
 * italic source line, with the title linked back to the passage. Null if the paragraph isn't a quotation.
 */
export function quoteBlock(raw: string): { text: string; attrib: number; link: { start: number; end: number; href: string } } | null {
  const m = raw.trim().match(QUOTE_RE);
  if (!m) return null;
  const words = `“${m[1].replace(/\n>\s?/g, " ").replace(/\s+/g, " ").trim()}”`;
  const attrib = words.length + 1;
  const lead = "— from ";
  const start = attrib + lead.length, end = start + m[2].length;
  return { text: `${words}\n${lead}${m[2]}${m[5]}`, attrib, link: { start, end, href: `#cite:${m[3]}/${m[4]}` } };
}
