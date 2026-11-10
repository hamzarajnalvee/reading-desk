// Essay or rabbit hole: each branch belongs to one. You can set it; otherwise a plain rule decides.
import type { Track, TreeNode } from "../data/types";

export const TRACK_LABEL: Record<Track, string> = { essay: "Essay", rabbit: "Rabbit hole" };

/**
 * The track of a branch. The seed has none.
 * - A track you set always wins.
 * - Definitions, Wikipedia cards and Claude explanations are for learning: rabbit hole.
 * - Anything growing out of a rabbit hole is a rabbit hole too.
 * - Everything else (your notes, summaries, clippings, sources added to the essay) is essay material.
 */
export function trackOf(n: TreeNode, nodes: Record<string, TreeNode>): Track | null {
  if (!n.parentId) return null;
  if (n.track) return n.track;
  if (n.kind === "definition" || n.kind === "explanation") return "rabbit";
  const seen = new Set<string>([n.id]);
  let p = nodes[n.parentId];
  while (p && p.parentId && !seen.has(p.id)) {
    seen.add(p.id);
    if (p.track) return p.track;
    if (p.kind === "definition" || p.kind === "explanation") return "rabbit";
    p = nodes[p.parentId];
  }
  return "essay";
}

/** Tracks for every node in a tree, worked out once. */
export function tracksOf(nodes: Record<string, TreeNode>, treeId: string): Record<string, Track | null> {
  const out: Record<string, Track | null> = {};
  for (const n of Object.values(nodes)) if (n.treeId === treeId) out[n.id] = trackOf(n, nodes);
  return out;
}

/** The other track, for the one-click switch on a card. */
export const otherTrack = (t: Track): Track => (t === "essay" ? "rabbit" : "essay");
