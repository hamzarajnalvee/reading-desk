// Tidy-tree layout for the map and the small tree silhouettes (d3-hierarchy's Reingold–Tilford layout).
import { stratify, tree as d3tree } from "d3-hierarchy";
import type { TreeNode } from "../data/types";

export interface Placed { id: string; x: number; y: number; depth: number; parentId: string | null }

/** Left-to-right layout: depth along x, siblings along y. */
export function layoutTree(nodes: TreeNode[], seedId: string, colW = 300, rowH = 120): Placed[] {
  const ids = new Set(nodes.map((n) => n.id));
  const usable = nodes.filter((n) => n.id === seedId || (n.parentId && ids.has(n.parentId)));
  if (!usable.some((n) => n.id === seedId)) return [];
  // Keep only nodes connected to the seed.
  const keep = new Set<string>([seedId]);
  let grew = true;
  while (grew) { grew = false; for (const n of usable) if (!keep.has(n.id) && n.parentId && keep.has(n.parentId)) { keep.add(n.id); grew = true; } }
  const list = usable.filter((n) => keep.has(n.id)).sort((a, b) => a.createdAt - b.createdAt);
  const root = stratify<TreeNode>().id((n) => n.id).parentId((n) => (n.id === seedId ? null : n.parentId))(list);
  d3tree<TreeNode>().nodeSize([rowH, colW]).separation((a, b) => (a.parent === b.parent ? 1 : 1.25))(root);
  return root.descendants().map((d) => ({ id: d.id!, x: d.y!, y: d.x!, depth: d.depth, parentId: d.parent?.id ?? null }));
}
