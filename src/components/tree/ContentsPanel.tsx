// A source's table of contents, opened from the card's Contents button. Each entry jumps to where that part begins,
// and your summaries sit under the parts they sum up.
import { useEffect, useRef } from "react";
import { NotebookPen, X } from "lucide-react";
import type { TocEntry, TreeNode } from "../../data/types";

interface ContentsPanelProps {
  entries: TocEntry[];
  /** Block id of the part being read, highlighted in the list. */
  current: string | null;
  /** Your summaries, by the block each part starts on. */
  summaries: Record<string, TreeNode[]>;
  locked: boolean;
  onJump: (blockId: string) => void;
  onSummarise: (blockId: string) => void;
  onOpenSummary: (nodeId: string) => void;
  onClose: () => void;
}

export function ContentsPanel({ entries, current, summaries, locked, onJump, onSummarise, onOpenSummary, onClose }: ContentsPanelProps) {
  const listRef = useRef<HTMLOListElement>(null);
  // Keep the part being read in view as the reader scrolls the book.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>("[aria-current='true']");
    el?.scrollIntoView({ block: "nearest" });
  }, [current]);

  return (
    <nav className="contents-panel" aria-label="Contents" data-testid="contents">
      <div className="contents-head">
        <span className="mono-label">Contents &amp; summaries</span>
        <button className="icon-btn" aria-label="Close contents" onClick={onClose}><X size={14} /></button>
      </div>
      <ol ref={listRef}>
        {entries.map((t, i) => {
          // Several entries can start on the same block; mark only the last of them as current.
          const on = t.blockId === current && entries[i + 1]?.blockId !== current;
          return (
            <li key={`${t.blockId}-${i}`} style={{ paddingLeft: (Math.min(t.level, 4) - 1) * 14 }}>
              <div className="contents-row">
                <button className={`contents-item lvl-${Math.min(t.level, 4)}${on ? " on" : ""}`} aria-current={on || undefined} onClick={() => onJump(t.blockId)}>{t.title}</button>
                {!locked && !summaries[t.blockId]?.length && entries[i + 1]?.blockId !== t.blockId && (
                  <button className="icon-btn contents-sum" aria-label={`Summarise ${t.title}`} title="Summarise this section" onClick={() => onSummarise(t.blockId)}><NotebookPen size={13} /></button>
                )}
              </div>
              {entries[i + 1]?.blockId !== t.blockId && summaries[t.blockId]?.map((s) => (
                <button key={s.id} className="contents-summary" onClick={() => onOpenSummary(s.id)}>{s.body?.trim() || "Empty summary"}</button>
              ))}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
