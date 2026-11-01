// SVG layer that draws threads: curved lines from a passage (at the page edge) to its margin card.
export interface Thread { key: string; annId: string; x1: number; y1: number; x2: number; y2: number; }

export function curve(x1: number, y1: number, x2: number, y2: number) {
  const dx = Math.max(24, Math.abs(x2 - x1) * 0.5);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

export function ThreadLayer({ threads, hotId, drag }: { threads: Thread[]; hotId: string | null; drag: { x1: number; y1: number; x2: number; y2: number } | null }) {
  return (
    <svg className="threads" aria-hidden>
      {threads.map((t) => (
        <g key={t.key} className={`thread${hotId === t.annId ? " hot" : ""}`}>
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
  );
}
