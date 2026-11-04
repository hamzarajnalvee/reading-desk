// The trail as sliding cards. Earlier cards stay pinned to the left as spines (position: sticky), so the
// chain is always visible and you can slide back. On a phone each card is full width and you swipe.
import { useCallback, useEffect, useRef, useState } from "react";
import type { Tree } from "../../data/types";
import { useStore } from "../../store/useStore";
import { ReadingCard } from "./ReadingCard";
import { useMedia, isTyping } from "../../lib/hooks";

export const SPINE = 44;

export function CardStack({ tree, path, onPath }: { tree: Tree; path: string[]; onPath: (p: string[]) => void }) {
  const nodes = useStore((s) => s.nodes);
  const ref = useRef<HTMLDivElement>(null);
  const compact = useMedia("(max-width: 760px)");
  const [active, setActive] = useState(path.length - 1);
  const prevLen = useRef(path.length);

  const scrollToCard = useCallback((i: number, smooth = true) => {
    const box = ref.current;
    const slot = box?.children[i] as HTMLElement | undefined;
    if (!box || !slot) return;
    const left = compact ? slot.offsetLeft : i * slot.offsetWidth - i * SPINE;
    box.scrollTo({ left: Math.max(0, left), behavior: smooth ? "smooth" : "auto" });
    setActive(i);
  }, [compact]);

  // Keyed on the trail's contents, not the array: the parent rebuilds `path` on every render, and
  // re-running this would yank the reader back to the last card while they're reading an earlier one.
  const pathKey = path.join(",");
  useEffect(() => {
    // A new card was opened: slide to it. Cards were closed: stay on the last one.
    const len = pathKey.split(",").length;
    const grew = len > prevLen.current;
    prevLen.current = len;
    requestAnimationFrame(() => scrollToCard(len - 1, grew));
  }, [pathKey, scrollToCard]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(document.activeElement) || e.metaKey || e.ctrlKey) return;
      if (e.key === "[" && active > 0) scrollToCard(active - 1);
      if (e.key === "]" && active < path.length - 1) scrollToCard(active + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, path.length, scrollToCard]);

  const onScroll = () => {
    if (!compact || !ref.current) return;
    const w = ref.current.clientWidth;
    setActive(Math.round(ref.current.scrollLeft / w));
  };

  return (
    <div className={`stack${compact ? " compact" : ""}`} ref={ref} onScroll={onScroll} data-testid="card-stack">
      {path.map((id, i) => {
        const node = nodes[id];
        if (!node) return null;
        return (
          <div className="slot" key={id} style={compact ? undefined : { left: i * SPINE, zIndex: i + 1, width: `calc(100cqw - ${(path.length - 1) * SPINE}px)` }}>
            <ReadingCard
              tree={tree} node={node} index={i} compact={compact} active={i === active}
              onActivate={() => setActive(i)}
              onSpine={() => scrollToCard(i)}
              onOpen={(childId) => {
                if (path[i + 1] === childId) { scrollToCard(i + 1); return; }
                onPath([...path.slice(0, i + 1), childId]);
              }}
              onClose={i > 0 ? () => onPath(path.slice(0, i)) : undefined}
            />
          </div>
        );
      })}
      {!compact && <div className="stack-end" aria-hidden />}
    </div>
  );
}
