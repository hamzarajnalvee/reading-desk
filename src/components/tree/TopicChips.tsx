// Topic chips on a tree, with a combobox to add an existing topic or create one.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, X } from "lucide-react";
import type { Tree } from "../../data/types";
import { useStore } from "../../store/useStore";

export function TopicChips({ tree }: { tree: Tree }) {
  const topics = useStore((s) => s.topics);
  const { updateTree, addTopic } = useStore.getState();
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const mine = tree.topicIds.map((id) => topics.find((t) => t.id === id)).filter(Boolean);
  const matches = useMemo(() => topics.filter((t) => !tree.topicIds.includes(t.id) && t.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6), [topics, tree.topicIds, q]);
  const add = (id: string) => { updateTree(tree.id, { topicIds: [...tree.topicIds, id] }); setQ(""); setAdding(false); };

  return (
    <div className="topic-chips">
      {mine.map((t) => (
        <span key={t!.id} className="chip topic">
          <Link to={`/topics?t=${t!.id}`}>{t!.name}</Link>
          {!tree.locked && <button aria-label={`Remove ${t!.name}`} onClick={() => updateTree(tree.id, { topicIds: tree.topicIds.filter((x) => x !== t!.id) })}><X size={11} /></button>}
        </span>
      ))}
      {tree.locked ? null : adding ? (
        <div className="topic-add">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Topic…" aria-label="Add topic"
            onBlur={() => setTimeout(() => setAdding(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && q.trim()) { e.preventDefault(); add(matches[0] && matches[0].name.toLowerCase() === q.trim().toLowerCase() ? matches[0].id : addTopic(q)); }
              if (e.key === "Escape") setAdding(false);
            }} />
          {q.trim() && (
            <div className="popover topic-menu">
              {matches.map((t) => <button key={t.id} onMouseDown={(e) => { e.preventDefault(); add(t.id); }}>{t.name}</button>)}
              {!matches.some((t) => t.name.toLowerCase() === q.trim().toLowerCase()) && <button onMouseDown={(e) => { e.preventDefault(); add(addTopic(q)); }}>Create “{q.trim()}”</button>}
            </div>
          )}
        </div>
      ) : (
        <button className="chip add" onClick={() => setAdding(true)}><Plus size={12} />Topic</button>
      )}
    </div>
  );
}
