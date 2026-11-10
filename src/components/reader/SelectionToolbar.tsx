// Frosted capsule shown when text is selected in a card. ✦ marks the only actions that call Claude.
import { BookOpen, GitBranch, PenLine, Globe, Highlighter, MessageCircle, Sparkles, StickyNote } from "lucide-react";

export type SelectionAction = "highlight" | "note" | "define" | "wikipedia" | "branch" | "cite" | "explain" | "ask";

const ITEMS: { id: SelectionAction; label: string; key: string; icon: JSX.Element; claude?: boolean }[] = [
  { id: "highlight", label: "Highlight", key: "H", icon: <Highlighter size={14} /> },
  { id: "note", label: "Note", key: "N", icon: <StickyNote size={14} /> },
  { id: "define", label: "Define", key: "D", icon: <BookOpen size={14} /> },
  { id: "wikipedia", label: "Wikipedia", key: "W", icon: <Globe size={14} /> },
  { id: "branch", label: "Branch", key: "B", icon: <GitBranch size={14} /> },
  { id: "cite", label: "Cite", key: "C", icon: <PenLine size={14} /> },
  { id: "explain", label: "Explain", key: "E", icon: <Sparkles size={14} />, claude: true },
  { id: "ask", label: "Ask", key: "A", icon: <MessageCircle size={14} />, claude: true },
];
export const SELECTION_KEYS: Record<string, SelectionAction> = Object.fromEntries(ITEMS.map((i) => [i.key.toLowerCase(), i.id]));

export function SelectionToolbar({ x, y, onAction }: { x: number; y: number; onAction: (a: SelectionAction) => void }) {
  return (
    <div className="sel-toolbar" data-testid="selection-toolbar" style={{ left: x, top: y }} role="toolbar" aria-label="Selection actions" onMouseDown={(e) => e.preventDefault()}>
      {ITEMS.map((i) => (
        <button key={i.id} className={i.claude ? "claude" : ""} onClick={() => onAction(i.id)} title={`${i.label}${i.claude ? " with Claude" : ""} (${i.key})`}>
          {i.icon}<span>{i.label}</span>
        </button>
      ))}
    </div>
  );
}
