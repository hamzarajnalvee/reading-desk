// Branches that grew from a paper, drawn beside the card the paper scrolls in.
// They sit level with the passage while you scroll, or spread evenly down the card.
import { useLayoutEffect, useState, type RefObject } from "react";
import type { TreeNode } from "../../data/types";
import { placePaperBranches, type PaperItem, type PaperLayout } from "../../lib/paperBranches";

const LABEL: Record<TreeNode["kind"], string> = { source: "Source", note: "Note", definition: "Definition", explanation: "Claude", clipping: "Clipping" };
const lookOf = (n: TreeNode) => (n.kind === "definition" && n.defSource?.site === "Wikipedia" ? "wiki" : n.kind);

interface Props {
  kids: TreeNode[];
  articleRef: RefObject<HTMLDivElement | null>;
  cardRef: RefObject<HTMLDivElement | null>;
  mode: PaperLayout;
  side: "left" | "right";
  onHot: (id: string | null) => void;
}

export function PaperRail({ kids, articleRef, cardRef, mode, side, onHot }: Props) {
  const [box, setBox] = useState({ top: 0, height: 240 });
  const [items, setItems] = useState<PaperItem[]>([]);

  useLayoutEffect(() => {
    const article = articleRef.current, card = cardRef.current;
    if (!article || !card) return;
    const measure = () => {
      const ar = article.getBoundingClientRect(), cr = card.getBoundingClientRect();
      const z = ar.height > 0 ? article.offsetHeight / ar.height : 1;
      setBox({ top: (ar.top - cr.top) / (z || 1), height: article.clientHeight });
      setItems(kids.map((k) => {
        const a = k.anchors[0];
        const block = a ? article.querySelector(`[data-block="${CSS.escape(a.blockId)}"]`) as HTMLElement | null : null;
        const order = a ? [...article.querySelectorAll("[data-block]")].findIndex((el) => el.getAttribute("data-block") === a.blockId) : 9999;
        let passageY: number | null = null;
        if (block) {
          const br = block.getBoundingClientRect();
          passageY = (br.top - ar.top + Math.min(br.height, 22) / 2) / (z || 1);
        }
        return { id: k.id, passageY, order: order < 0 ? 9999 : order, quote: a?.quote || k.title, page: a?.page };
      }));
    };
    measure();
    article.addEventListener("scroll", measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(article);
    return () => { article.removeEventListener("scroll", measure); ro.disconnect(); };
  }, [articleRef, cardRef, kids]);

  const places = placePaperBranches(items, box.height, mode);
  const byId = new Map(kids.map((k) => [k.id, k]));

  const showPassage = (id: string) => {
    const article = articleRef.current;
    const kid = byId.get(id);
    const blockId = kid?.anchors[0]?.blockId;
    const block = article && blockId ? article.querySelector(`[data-block="${CSS.escape(blockId)}"]`) as HTMLElement | null : null;
    if (!article || !block) return;
    const z = article.offsetHeight / (article.getBoundingClientRect().height || article.offsetHeight);
    const y = (block.getBoundingClientRect().top - article.getBoundingClientRect().top) / (z || 1) + article.scrollTop;
    article.scrollTop = Math.max(0, y - article.clientHeight / 3);
  };

  return (
    <div className={`paper-rail side-${side}`} data-testid="paper-rail" data-mode={mode} style={{ top: box.top, height: box.height }}>
      <svg className="paper-threads" aria-hidden="true">
        {places.filter((p) => p.visible && p.passageY != null).map((p) => {
          const y1 = p.passageY!;
          const y2 = p.top + 28;
          const x1 = side === "right" ? 0 : 36;
          const x2 = side === "right" ? 36 : 0;
          return <path key={p.id} d={`M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`} />;
        })}
      </svg>
      {places.filter((p) => p.visible).map((p) => {
        const k = byId.get(p.id);
        if (!k) return null;
        return (
          <button
            key={p.id}
            type="button"
            className={`paper-branch kind-${lookOf(k)}`}
            data-testid="paper-branch"
            data-branch={p.id}
            style={{ top: p.top }}
            onMouseEnter={() => onHot(p.id)}
            onMouseLeave={() => onHot(null)}
            onClick={(e) => { e.stopPropagation(); showPassage(p.id); }}
          >
            <span className="mono-label">{LABEL[k.kind]}{p.page ? ` · p. ${p.page}` : ""}</span>
            <span className="paper-branch-title serif">{k.title}</span>
            <span className="paper-quote serif">“{p.quote}”</span>
          </button>
        );
      })}
    </div>
  );
}
