// Readable content for any card, and helpers for walking a tree.
import type { Block, Content, Doc, TreeNode } from "../data/types";
import { quoteBlock } from "./writing";

/** Split a Markdown body into blocks. Block ids are stable for a given paragraph position. */
export function bodyBlocks(nodeId: string, body: string): Block[] {
  return (body || "")
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s, i) => {
      // A quotation you added from a source keeps its link back to the passage, and its source line.
      const q = quoteBlock(s);
      if (q) return { id: `${nodeId}-p${i + 1}`, kind: "p", text: q.text, page: 1, quote: true, attrib: q.attrib, links: [q.link] } as Block;
      const h = s.match(/^#{1,6}\s+(.*)$/s);
      const raw = (h ? h[1] : s).replace(/\s+/g, " ");
      // Cards show plain text (offsets are measured on it), so drop Markdown emphasis markers.
      const text = raw.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1$2");
      return { id: `${nodeId}-p${i + 1}`, kind: h ? "h" : "p", text, page: 1 } as Block;
    });
}

/**
 * Where in the raw body a reader position lands: paragraph `blockIndex` (as `bodyBlocks` numbers them),
 * `offset` characters in. Used to put the cursor where you clicked when a card switches to writing.
 * Approximate inside paragraphs that use Markdown emphasis or repeated spaces; clamped to the paragraph.
 */
export function bodyOffset(body: string, blockIndex: number, offset: number): number {
  const re = /[^\n]+(?:\n(?!\n)[^\n]*)*/g;
  let i = 0;
  for (let m = re.exec(body); m; m = re.exec(body)) {
    const raw = m[0];
    if (!raw.trim()) continue;
    if (i === blockIndex) {
      const lead = raw.length - raw.trimStart().length;
      const prefix = raw.trimStart().match(/^#{1,6}\s+/)?.[0].length ?? 0;
      const start = m.index + lead + prefix;
      const end = m.index + raw.trimEnd().length;
      return Math.min(start + Math.max(0, offset), end);
    }
    i++;
  }
  return body.length;
}

export function contentOf(node: TreeNode, docs: Record<string, Doc>): Content {
  if (node.kind === "source" && node.docId && docs[node.docId]) {
    const d = docs[node.docId];
    return { id: node.id, title: d.title, blocks: d.blocks };
  }
  const text = node.kind === "clipping" ? [node.clip?.text || "", node.body || ""].filter(Boolean).join("\n\n") : node.body || "";
  return { id: node.id, title: node.title, blocks: bodyBlocks(node.id, text) };
}

/** Seed-first chain of ids from the root to `id`. */
export function pathTo(nodes: Record<string, TreeNode>, id: string): string[] {
  const out: string[] = [];
  let cur: TreeNode | undefined = nodes[id];
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) { seen.add(cur.id); out.unshift(cur.id); cur = cur.parentId ? nodes[cur.parentId] : undefined; }
  return out;
}

export function childrenOf(nodes: TreeNode[], parentId: string): TreeNode[] {
  return nodes.filter((n) => n.parentId === parentId).sort((a, b) => a.createdAt - b.createdAt);
}

/** All descendants of a node (not including it). */
export function descendants(nodes: TreeNode[], id: string): string[] {
  const out: string[] = [];
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const n of nodes) if (n.parentId === cur) { out.push(n.id); stack.push(n.id); }
  }
  return out;
}

/** Plain text of a card for prompts and search. */
export function plainText(c: Content): string {
  return c.blocks.map((b) => `[p. ${b.page}] ${b.kind === "h" ? "## " : ""}${b.text}`).join("\n\n");
}

/**
 * The nodes the map shows. Notes, definitions, clippings and explanations live in a card's margin; they join
 * the map only once something grows from them. Sources always show, and so does anything on the open trail.
 */
export function mapNodes(nodes: TreeNode[], seedId: string, keep: Set<string> = new Set(), showMargin = false): TreeNode[] {
  if (showMargin) return nodes;
  const parents = new Set(nodes.map((n) => n.parentId).filter(Boolean));
  return nodes.filter((n) => n.id === seedId || n.kind === "source" || parents.has(n.id) || keep.has(n.id));
}
