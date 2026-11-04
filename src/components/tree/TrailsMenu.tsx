// Saved trails: chains of cards you had open, most recent first.
import { useState } from "react";
import { History } from "lucide-react";
import type { Tree } from "../../data/types";
import { useStore } from "../../store/useStore";
import { contentOf } from "../../lib/content";
import { timeAgo } from "../../lib/util";

export function useTrailLabel() {
  const nodes = useStore((s) => s.nodes);
  const docs = useStore((s) => s.docs);
  return (ids: string[]) => ids.map((id) => nodes[id]).filter(Boolean).map((n) => contentOf(n, docs).title);
}

export function TrailsMenu({ tree, onOpen }: { tree: Tree; onOpen: (ids: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const label = useTrailLabel();
  return (
    <div className="trails">
      <button className="btn btn-ghost btn-sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}><History size={14} />Trails</button>
      {open && (
        <div className="popover trails-menu" onMouseLeave={() => setOpen(false)}>
          <div className="mono-label">Resume a trail</div>
          {tree.trails.length === 0 && <p className="muted small pad">Trails you follow are saved here.</p>}
          {tree.trails.map((t) => (
            <button key={t.id} onClick={() => { onOpen(t.nodeIds); setOpen(false); }}>
              <span className="trail-chain serif">{label(t.nodeIds).join(" › ")}</span>
              <span className="muted small">{timeAgo(t.openedAt)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
