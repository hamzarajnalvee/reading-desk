import type { PointerEvent } from "react";
// SVG layer that draws threads: curved lines from a passage (at the page's edge) to its card in the left or right margin.
export interface Thread { key: string; annId: string; /** Index of the link among the branch anchors. */ ai?: number; /** Branch kind, for its colour. */ kind?: string; x1: number; y1: number; x2: number; y2: number; }

export function curve(x1: number, y1: number, x2: number, y2: number) {
  const dx = Math.max(24, Math.abs(x2 - x1) * 0.5) * (x2 >= x1 ? 1 : -1);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

export function ThreadLayer({ threads, hotId, drag, onGrab }: { threads: Thread[]; hotId: string | null; drag: { x1: number; y1: number; x2: number; y2: number } | null; onGrab?: (t: Thread, e: PointerEvent<SVGCircleElement>) => void }) {
  return (<>
    <svg className="threads" aria-hidden>
      {threads.map((t) => (
        <g key={t.key} className={`thread t-${t.kind || "note"}${hotId === t.annId ? " hot" : ""}`} data-branch-link={t.annId}>
          <path d={curve(t.x1, t.y1, t.x2, t.y2)} />
          <circle cx={t.x1} cy={t.y1} r={2.5} />
        </g>
      ))}
      {drag && (
        <g className="thread dragging">
          <path d={curve(drag.x1, drag.y1, drag.x2, drag.y2)} />
          <circle cx={drag.x1} cy={drag.y1} r={3} />
          <circle className="tip" cx={drag.x2} cy={drag.y2} r={5} />
        </g>
      )}
    </svg>
    {/* The ends of links sit above the page's edge handles, so they can be grabbed. */}
    {onGrab && (
      <svg className="threads thread-ends">
        {threads.filter((t) => t.ai != null).map((t) => (
          <g key={t.key} className={`thread t-${t.kind || "note"}`} data-branch-link={t.annId}>
            <circle className="grab" data-testid="link-end" cx={t.x1} cy={t.y1} r={7} onPointerDown={(e) => onGrab(t, e)}><title>Drag to another sentence to move this link, or click to unlink</title></circle>
          </g>
        ))}
      </svg>
    )}
  </>);
}
