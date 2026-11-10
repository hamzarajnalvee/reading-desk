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
 * Add an excerpt to the end of the writing: the words as a quotation, then a link to exactly where they came from.
 *   > Painting a wall teaches patience.
 *   > — [The Dark Side of Optimization](#cite:nodeId/blockId)
 */
export function appendExcerpt(text: string, a: Anchor, sourceTitle: string): string {
  const t = (text || "").replace(/\s+$/, "");
  const quote = a.quote.replace(/\s+/g, " ").trim();
  const title = sourceTitle.replace(/[[\]]/g, "").trim() || "Source";
  return (t ? t + "\n\n" : "") + `> ${quote}\n> — [${title}](#cite:${a.docId}/${a.blockId})\n\n`;
}
