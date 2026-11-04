// Renders a card's text as a paper sheet. Branches and highlights are drawn as <mark> segments computed
// from their anchors, so the DOM is never mutated by hand and marks survive re-renders.
// Never add text nodes inside a block (use CSS ::before/::after): offsets are measured on textContent.
import { memo, type ReactNode } from "react";
import type { Anchor, Block, Content } from "../../data/types";
import { resolveRange } from "../../lib/anchors";

export interface MarkSpec { id: string; kind: string; anchors: Anchor[] }

const PRIORITY = ["source", "definition", "explanation", "note", "clipping", "highlight"];

function segments(block: Block, marks: MarkSpec[], hotId: string | null): ReactNode[] {
  const ranges: { start: number; end: number; m: MarkSpec }[] = [];
  for (const m of marks) for (const a of m.anchors) {
    const r = resolveRange(block, a);
    if (r && r[1] > r[0]) ranges.push({ start: r[0], end: r[1], m });
  }
  if (!ranges.length) return [block.text];
  const cuts = new Set<number>([0, block.text.length]);
  ranges.forEach((r) => { cuts.add(r.start); cuts.add(r.end); });
  const pts = [...cuts].sort((a, b) => a - b);
  const out: ReactNode[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const s = pts[i], e = pts[i + 1];
    const text = block.text.slice(s, e);
    const over = ranges.filter((r) => r.start <= s && r.end >= e).map((r) => r.m);
    if (!over.length) { out.push(text); continue; }
    const kinds = new Set(over.map((m) => m.kind));
    const top = PRIORITY.find((k) => kinds.has(k)) || over[0].kind;
    const cls = ["mk", `k-${top}`];
    if (kinds.has("highlight") && top !== "highlight") cls.push("k-hl-under");
    if (hotId && over.some((m) => m.id === hotId)) cls.push("hot");
    out.push(<mark key={s} className={cls.join(" ")} data-ann={over.map((m) => m.id).join(" ")} data-kind={top}>{text}</mark>);
  }
  return out;
}

interface Props {
  content: Content;
  marks: MarkSpec[];
  hotId: string | null;
  flashBlockId: string | null;
  showPages: boolean;
  header?: ReactNode;
}

export const DocumentSheet = memo(function DocumentSheet({ content, marks, hotId, flashBlockId, showPages, header }: Props) {
  let lastPage = 0;
  return (
    <article className="sheet" aria-label={content.title}>
      {header}
      {content.blocks.map((b) => {
        const pageMark = showPages && b.page !== lastPage ? <div className="page-mark" data-page={b.page} key={`pg-${b.page}`}>p. {b.page}</div> : null;
        lastPage = b.page;
        const Tag = b.kind === "h" ? "h2" : "p";
        return [
          pageMark,
          <Tag key={b.id} id={`block-${b.id}`} data-block={b.id} className={`blk blk-${b.kind}${flashBlockId === b.id ? " flash" : ""}`}>
            {segments(b, marks, hotId)}
          </Tag>,
        ];
      })}
    </article>
  );
});
