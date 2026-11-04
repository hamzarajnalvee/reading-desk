// Topics form a web: a topic can sit under several bigger topics. The outline shows each topic under every parent.
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronRight, Plus, Trash2, X } from "lucide-react";
import type { Topic } from "../data/types";
import { useStore, wouldCycle } from "../store/useStore";
import { EmptyState } from "../components/ui";
import { plural } from "../lib/util";

export function TopicsScreen() {
  const topics = useStore((s) => s.topics);
  const trees = useStore((s) => s.trees);
  const { addTopic } = useStore.getState();
  const [params, setParams] = useSearchParams();
  const [draft, setDraft] = useState("");
  const selected = topics.find((t) => t.id === params.get("t"));
  const byId = useMemo(() => Object.fromEntries(topics.map((t) => [t.id, t])), [topics]);
  const roots = topics.filter((t) => !t.parentIds.some((p) => byId[p])).sort((a, b) => a.name.localeCompare(b.name));
  const kids = (id: string) => topics.filter((t) => t.parentIds.includes(id)).sort((a, b) => a.name.localeCompare(b.name));
  const treeCount = (id: string) => trees.filter((t) => t.topicIds.includes(id)).length;

  const Row = ({ t, depth, via, seen }: { t: Topic; depth: number; via?: string; seen: Set<string> }) => {
    if (seen.has(t.id)) return null;
    const next = new Set(seen).add(t.id);
    const others = t.parentIds.filter((p) => p !== via && byId[p]).map((p) => byId[p].name);
    return (
      <>
        <button className={`topic-row${selected?.id === t.id ? " on" : ""}`} style={{ paddingLeft: 12 + depth * 20 }} onClick={() => setParams({ t: t.id })} data-testid="topic-row">
          {kids(t.id).length ? <ChevronRight size={13} className="muted" /> : <span className="tr-dot" />}
          <span className="tr-name">{t.name}</span>
          {via && others.length > 0 && <span className="tr-also muted small">also under {others.join(", ")}</span>}
          <span className="flex1" />
          {treeCount(t.id) > 0 && <span className="muted small tabular">{treeCount(t.id)}</span>}
        </button>
        {kids(t.id).map((k) => <Row key={k.id} t={k} depth={depth + 1} via={t.id} seen={next} />)}
      </>
    );
  };

  return (
    <div className="workspace">
      <header className="ws-bar"><h1 className="serif ws-title">Topics</h1><span className="muted small">{plural(topics.length, "topic")}</span></header>
      <div className="topics-layout">
        <div className="topics-outline">
          <form className="topic-new" onSubmit={(e) => { e.preventDefault(); if (!draft.trim()) return; const id = addTopic(draft); setDraft(""); setParams({ t: id }); }}>
            <Plus size={14} /><input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="New topic, e.g. Syllogistic method" aria-label="New topic" />
          </form>
          {topics.length === 0 && <p className="muted small pad">No topics yet. Add one here, or from a tree's header.</p>}
          {roots.map((t) => <Row key={t.id} t={t} depth={0} seen={new Set()} />)}
        </div>
        <div className="topics-detail">
          {selected ? <TopicDetail topic={selected} /> : <EmptyState title="Choose a topic" body="Topics can sit under more than one bigger topic. Logic, for example, can belong to both Philosophy and Computer Science." />}
        </div>
      </div>
    </div>
  );
}

function TopicDetail({ topic }: { topic: Topic }) {
  const topics = useStore((s) => s.topics);
  const trees = useStore((s) => s.trees);
  const { updateTopic, deleteTopic } = useStore.getState();
  const [, setParams] = useSearchParams();
  const [armed, setArmed] = useState(false);
  const byId = Object.fromEntries(topics.map((t) => [t.id, t]));
  const descendants = useMemo(() => {
    const out = new Set<string>(); const stack = [topic.id];
    while (stack.length) { const c = stack.pop()!; topics.forEach((t) => { if (t.parentIds.includes(c) && !out.has(t.id)) { out.add(t.id); stack.push(t.id); } }); }
    return out;
  }, [topics, topic.id]);
  const direct = trees.filter((t) => t.topicIds.includes(topic.id));
  const viaSub = trees.filter((t) => !t.topicIds.includes(topic.id) && t.topicIds.some((x) => descendants.has(x)));
  const candidates = topics.filter((t) => t.id !== topic.id && !topic.parentIds.includes(t.id));

  return (
    <div className="topic-detail" data-testid="topic-detail">
      <input className="topic-name serif" value={topic.name} onChange={(e) => updateTopic(topic.id, { name: e.target.value })} aria-label="Topic name" />
      <section>
        <div className="mono-label">Sits under</div>
        <div className="chips">
          {topic.parentIds.filter((p) => byId[p]).map((p) => (
            <span key={p} className="chip topic"><button className="chip-link" onClick={() => setParams({ t: p })}>{byId[p].name}</button><button aria-label={`Remove from ${byId[p].name}`} onClick={() => updateTopic(topic.id, { parentIds: topic.parentIds.filter((x) => x !== p) })}><X size={11} /></button></span>
          ))}
          <select className="chip-select" value="" aria-label="Add a parent topic" onChange={(e) => { if (e.target.value) updateTopic(topic.id, { parentIds: [...topic.parentIds, e.target.value] }); }}>
            <option value="">Add a parent topic…</option>
            {candidates.map((t) => <option key={t.id} value={t.id} disabled={wouldCycle(topics, topic.id, [t.id])}>{t.name}{wouldCycle(topics, topic.id, [t.id]) ? " (inside this topic)" : ""}</option>)}
          </select>
        </div>
        {topic.parentIds.length === 0 && <p className="muted small">A top-level topic.</p>}
      </section>
      {descendants.size > 0 && (
        <section>
          <div className="mono-label">Smaller topics</div>
          <div className="chips">{topics.filter((t) => t.parentIds.includes(topic.id)).map((t) => <button key={t.id} className="chip" onClick={() => setParams({ t: t.id })}>{t.name}</button>)}</div>
        </section>
      )}
      <section>
        <div className="mono-label">Trees</div>
        {direct.length === 0 && viaSub.length === 0 && <p className="muted small">No trees yet. Add this topic from a tree's header.</p>}
        {direct.map((t) => <Link key={t.id} to={`/tree/${t.id}`} className="topic-tree serif">{t.title}</Link>)}
        {viaSub.map((t) => <Link key={t.id} to={`/tree/${t.id}`} className="topic-tree serif">{t.title} <span className="muted small">via {t.topicIds.filter((x) => descendants.has(x)).map((x) => byId[x]?.name).join(", ")}</span></Link>)}
      </section>
      <button className={`btn btn-ghost btn-sm${armed ? " danger" : ""}`} onClick={() => { if (armed) { deleteTopic(topic.id); setParams({}); } else { setArmed(true); setTimeout(() => setArmed(false), 3000); } }}><Trash2 size={13} />{armed ? "Delete topic? Trees keep their content." : "Delete topic"}</button>
    </div>
  );
}
