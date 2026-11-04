// Branching actions shared by cards, dialogs and the command palette. They work on the store directly.
import type { Anchor, Depth, TreeNode } from "../data/types";
import { useStore } from "../store/useStore";
import { contentOf } from "./content";
import { defineTerm, explain, fetchAsDoc } from "./api";
import { toast } from "./toast";

const S = () => useStore.getState();
const running = new Map<string, AbortController>();

export const noteTitle = (body: string) => {
  const t = body.replace(/[#*_>`]/g, "").replace(/\s+/g, " ").trim();
  return t.length > 60 ? t.slice(0, 57).replace(/\s+\S*$/, "") + "…" : t || "Note";
};

/** Open a web address as a source branch. The card appears at once and fills in when the page arrives. */
export function branchFromUrl(treeId: string, parentId: string, anchor: Anchor | null, url: string, title?: string): string {
  const id = S().addBranch(treeId, {
    kind: "source", title: title || url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 80), parentId,
    anchors: anchor ? [anchor] : [], url, pending: true,
  });
  loadUrl(id);
  return id;
}

export async function loadUrl(nodeId: string) {
  const n = S().nodes[nodeId];
  if (!n?.url) return;
  S().updateNode(nodeId, { pending: true, error: undefined });
  try {
    const doc = await fetchAsDoc(n.url);
    useStore.setState((s) => ({ docs: { ...s.docs, [doc.id]: doc } }));
    S().updateNode(nodeId, { docId: doc.id, title: doc.title, pending: false });
  } catch (e) {
    S().updateNode(nodeId, { pending: false, error: (e as Error).message || "Couldn't open that page." });
  }
}

/** A definition branch from Wiktionary or Wikipedia. If none is found, the card asks you to write one. */
export function branchDefinition(treeId: string, parentId: string, anchor: Anchor): string {
  const term = anchor.quote.replace(/^[^\w]+|[^\w]+$/g, "").slice(0, 80) || anchor.quote;
  const id = S().addBranch(treeId, { kind: "definition", title: term, parentId, anchors: [anchor], body: "", pending: true });
  defineTerm(term).then((r) => {
    if (!S().nodes[id]) return;
    if (r) S().updateNode(id, { title: r.term, body: r.text, defSource: r.source, pending: false });
    else S().updateNode(id, { pending: false });
  });
  return id;
}

/** Ask Claude to explain a passage. Only ever called from an explicit button. */
export function branchExplanation(treeId: string, parentId: string, anchor: Anchor, depth: Depth = "educational"): string {
  const id = S().addBranch(treeId, { kind: "explanation", title: anchor.quote.slice(0, 60), parentId, anchors: [anchor], body: "", depth, pending: true });
  runExplain(id);
  return id;
}

export async function runExplain(nodeId: string, depth?: Depth) {
  const s = S();
  const n = s.nodes[nodeId];
  if (!n || !n.parentId) return;
  const parent = s.nodes[n.parentId];
  const anchor = n.anchors[0];
  const content = contentOf(parent, s.docs);
  const block = content.blocks.find((b) => b.id === anchor?.blockId);
  running.get(nodeId)?.abort();
  const ctl = new AbortController();
  running.set(nodeId, ctl);
  const d = depth || n.depth || "educational";
  s.updateNode(nodeId, { pending: true, depth: d, body: "", error: undefined });
  try {
    await explain({
      passage: anchor?.quote || n.title, context: block?.text || "", title: content.title, depth: d, signal: ctl.signal,
      onText: (t) => S().updateNode(nodeId, { body: t }),
    });
    S().updateNode(nodeId, { pending: false });
  } catch (e) {
    if ((e as Error).name !== "AbortError") S().updateNode(nodeId, { pending: false, error: "Couldn't reach Claude. Is the app's server running?" });
  } finally { running.delete(nodeId); }
}

/** Explain a definition (or any branch) more deeply: a Claude explanation growing from the same passage. */
export function explainNode(n: TreeNode) {
  if (!n.parentId || !n.anchors[0]) return;
  const id = branchExplanation(n.treeId, n.parentId, n.anchors[0], "both");
  toast("Claude is explaining in the margin");
  return id;
}
