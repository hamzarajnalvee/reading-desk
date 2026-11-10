// The zoomed-out view: every branch as a node, joined by the passages that led to it. Built on React Flow.
import { useMemo, useState } from "react";
import { Background, Controls, Handle, MiniMap, Position, ReactFlow, type Edge, type Node, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Tree, TreeNode } from "../../data/types";
import { useStore } from "../../store/useStore";
import { layoutTree } from "../../lib/layout";
import { contentOf, mapNodes, pathTo } from "../../lib/content";
import { KIND_LABEL } from "./BranchCard";
import { TRACK_LABEL, tracksOf } from "../../lib/tracks";
import { Segmented } from "../ui";
import type { Track } from "../../data/types";

type MapData = { node: TreeNode; title: string; snippet: string; seed: boolean; onPath: boolean; children: number; track: Track | null; dim: boolean };

function MapNode({ data }: NodeProps<Node<MapData>>) {
  const { node, title, snippet, seed, onPath, children, track, dim } = data;
  return (
    <div className={`mapnode k-${node.kind}${seed ? " seed" : ""}${onPath ? " on-path" : ""}${track ? ` t-${track}` : ""}${dim ? " dim" : ""}`} data-testid="map-node" data-node={node.id} data-track={track || undefined}>
      <Handle type="target" position={Position.Left} />
      <div className="mn-kicker mono-label"><span className={`kdot k-${node.kind}`} />{seed ? "Seed" : node.kind === "explanation" ? "Claude" : KIND_LABEL[node.kind]}{track && <span className={`track-chip t-${track}`}>{TRACK_LABEL[track]}</span>}{children ? <span className="mn-count">{children}</span> : null}</div>
      <div className="mn-title serif">{title}</div>
      {snippet && <div className="mn-snippet">{snippet}</div>}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
const nodeTypes = { branch: MapNode };

export function TreeMap({ tree, path, onOpenPath }: { tree: Tree; path: string[]; onOpenPath: (p: string[]) => void }) {
  const allNodes = useStore((s) => s.nodes);
  const docs = useStore((s) => s.docs);
  const theme = useStore((s) => s.ui.theme);
  const [showMargin, setShowMargin] = useState(false);
  const [only, setOnly] = useState<"all" | Track>("all");
  const pathKey = path.join(",");

  const { nodes, edges, hidden } = useMemo(() => {
    const all = Object.values(allNodes).filter((n) => n.treeId === tree.id);
    const onPath = new Set(pathKey.split(","));
    // Filtering by track shows margin branches too: most rabbit holes are definitions and explanations.
    const list = mapNodes(all, tree.seedId, onPath, showMargin || only !== "all");
    const placed = layoutTree(list, tree.seedId, 330, 132);
    const tracks = tracksOf(allNodes, tree.id);
    const counts: Record<string, number> = {};
    all.forEach((n) => { if (n.parentId) counts[n.parentId] = (counts[n.parentId] || 0) + 1; });
    const nodes: Node<MapData>[] = placed.map((p) => {
      const n = allNodes[p.id];
      const c = contentOf(n, docs);
      const firstText = n.kind === "source" ? c.blocks.find((b) => b.kind === "p")?.text || "" : n.kind === "clipping" ? n.clip?.text || "" : n.body || "";
      return {
        id: n.id, type: "branch", position: { x: p.x, y: p.y },
        data: { node: n, title: n.kind === "source" ? c.title : n.title, snippet: firstText.replace(/[*_#>]/g, "").slice(0, 110), seed: n.id === tree.seedId, onPath: onPath.has(n.id), children: counts[n.id] || 0,
          track: tracks[n.id] ?? null, dim: only !== "all" && n.id !== tree.seedId && tracks[n.id] !== only },
      };
    });
    const edges: Edge[] = placed.filter((p) => p.parentId).map((p) => {
      const n = allNodes[p.id];
      const q = n.anchors[0]?.quote || "";
      const on = onPath.has(p.id) && onPath.has(p.parentId!);
      // Only edges on the current trail carry their passage as a label, so the map stays calm.
      return { id: `${p.parentId}->${p.id}`, source: p.parentId!, target: p.id, label: on && q ? `“${q.length > 34 ? q.slice(0, 32) + "…" : q}”` : undefined, className: on ? "on-path" : "" };
    });
    return { nodes, edges, hidden: all.length - list.length };
  }, [allNodes, docs, tree.id, tree.seedId, pathKey, showMargin, only]);

  const colorMode = theme === "system" ? "system" : theme;
  return (
    <div className="tree-map" data-testid="tree-map">
      <ReactFlow
        nodes={nodes} edges={edges} nodeTypes={nodeTypes} colorMode={colorMode}
        fitView fitViewOptions={{ padding: 0.2, maxZoom: 1 }} minZoom={0.15} maxZoom={1.6}
        nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
        onNodeClick={(_, n) => onOpenPath(pathTo(allNodes, n.id))}
      >
        <Background gap={24} size={1} />
        <Controls showInteractive={false} position="bottom-right" />
        <MiniMap pannable zoomable position="bottom-left" nodeBorderRadius={8} nodeClassName={(n) => `mm-${(n.data as MapData).node.kind}${(n.data as MapData).onPath ? " mm-on" : ""}`} />
      </ReactFlow>
      <div className="map-filter">
        <Segmented size="sm" label="Show" value={only} onChange={setOnly} options={[{ value: "all", label: "All" }, { value: "essay", label: "Essay" }, { value: "rabbit", label: "Rabbit holes" }]} />
      </div>
      <div className="map-hint muted small">
        <span>Click any branch to open its trail as cards. Scroll or pinch to zoom.</span>
        {only === "all" && (hidden > 0 || showMargin) && (
          <button className="btn btn-secondary btn-sm" aria-pressed={showMargin} onClick={() => setShowMargin((v) => !v)}>
            {showMargin ? "Hide margin notes" : `Show margin notes (${hidden})`}
          </button>
        )}
      </div>
    </div>
  );
}
