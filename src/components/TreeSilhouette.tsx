// A small drawing of a tree's shape, for the home screen cards.
import { useMemo } from "react";
import type { TreeNode } from "../data/types";
import { layoutTree } from "../lib/layout";

const KIND_COLOR: Record<string, string> = { source: "var(--accent)", note: "var(--k-note)", definition: "var(--k-definition)", explanation: "var(--k-claude)", clipping: "var(--k-clipping)" };

export function TreeSilhouette({ nodes, seedId }: { nodes: TreeNode[]; seedId: string }) {
  const pts = useMemo(() => layoutTree(nodes, seedId, 40, 16), [nodes, seedId]);
  if (!pts.length) return null;
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs, minX + 1), minY = Math.min(...ys), maxY = Math.max(...ys, minY + 1);
  const W = 220, H = 96, pad = 10;
  const sx = (x: number) => pad + ((x - minX) / Math.max(1, maxX - minX)) * (W - pad * 2);
  const sy = (y: number) => (maxY === minY ? H / 2 : pad + ((y - minY) / (maxY - minY)) * (H - pad * 2));
  const by = Object.fromEntries(pts.map((p) => [p.id, p]));
  const kinds = Object.fromEntries(nodes.map((n) => [n.id, n.kind]));
  return (
    <svg className="silhouette" viewBox={`0 0 ${W} ${H}`} aria-hidden>
      {pts.filter((p) => p.parentId && by[p.parentId]).map((p) => {
        const q = by[p.parentId!];
        const x1 = sx(q.x), y1 = sy(q.y), x2 = sx(p.x), y2 = sy(p.y), mx = (x1 + x2) / 2;
        return <path key={p.id} d={`M${x1} ${y1} C${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`} />;
      })}
      {pts.map((p) => <circle key={p.id} cx={sx(p.x)} cy={sy(p.y)} r={p.parentId ? 3.2 : 5} style={{ fill: KIND_COLOR[kinds[p.id]] || "var(--accent)" }} />)}
    </svg>
  );
}
