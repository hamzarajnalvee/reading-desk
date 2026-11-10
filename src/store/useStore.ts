import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Anchor, ChatTurn, Doc, Highlight, Topic, Trail, Tree, TreeNode } from "../data/types";
import { sampleDocs, sampleNodes, sampleTopics, sampleTrees } from "../data/sample";
import { idbStorage } from "./storage";
import { uid } from "../lib/util";
import { descendants } from "../lib/content";

export type Theme = "system" | "light" | "dark";
export type View = "cards" | "map";

export interface UIState {
  theme: Theme;
  sidebarOpen: boolean;
  /** Right drawer on the tree screen. */
  drawer: null | "understanding" | "ask";
  /** Hide the sidebar and tree header while reading. */
  focus: boolean;
  paletteOpen: boolean;
  coachStep: number;
  /** Passage queued for Ask Claude. */
  pendingQuote: Anchor | null;
  pendingAsk: string | null;
  lastSavedAt: number;
  /** Width of the margin beside the page, set by dragging its edge. Unset means the default. */
  marginWidth?: number;
  /** Show the margin of branch cards beside the page. Off by default so the page sits alone in the centre. */
  branchesOpen?: boolean;
  /** A web page or Wikipedia article open in the floating reader, and the passage that led there. Not saved. */
  /** With `nodeId`, it shows a source already in the tree (e.g. one you just added) instead of fetching `url`. */
  reader: null | { url: string; title?: string; treeId: string; parentId: string; anchor: Anchor | null; nodeId?: string };
  /** How large the page reads in Read view (1 = normal). Zoom out to see the whole page and both margins. */
  readZoom?: number;
  /** A source branch whose article is open in place in its margin card. */
  readingBeside?: string | null;
  /** A branch open in the floating editor (Open on a note, definition, explanation or clipping). Not saved. */
  popup: string | null;
  /** A passage to scroll to once its card is open (from a link in your writing or the notebook). Not saved. */
  jumpTo?: null | { nodeId: string; blockId: string };
}

export interface Data {
  trees: Tree[];
  nodes: Record<string, TreeNode>;
  docs: Record<string, Doc>;
  topics: Topic[];
  highlights: Highlight[];
  chats: Record<string, ChatTurn[]>;
  ui: UIState;
}

type NewTree = { title?: string; topicIds?: string[] } & ({ kind: "source"; doc: Doc } | { kind: "note"; title: string; body: string });
type NewBranch = Omit<TreeNode, "id" | "treeId" | "createdAt"> & { doc?: Doc };

interface Actions {
  setUI: (patch: Partial<UIState>) => void;

  createTree: (seed: NewTree) => string;
  updateTree: (id: string, patch: Partial<Tree>) => void;
  deleteTree: (id: string) => void;
  /** Record the open chain of cards. Most recent first, duplicates removed, at most 12 kept. */
  recordTrail: (treeId: string, nodeIds: string[]) => void;

  addBranch: (treeId: string, b: NewBranch) => string;
  updateNode: (id: string, patch: Partial<TreeNode>) => void;
  /** Removes a branch and everything that grew from it. */
  removeNode: (id: string) => void;
  addAnchor: (id: string, anchor: Anchor) => void;

  addHighlight: (nodeId: string, anchor: Anchor) => string;
  updateHighlight: (id: string, anchor: Anchor) => void;
  removeHighlight: (id: string) => void;

  addTopic: (name: string, parentIds?: string[]) => string;
  updateTopic: (id: string, patch: Partial<Topic>) => void;
  deleteTopic: (id: string) => void;

  pushChat: (treeId: string, turn: Omit<ChatTurn, "id" | "createdAt">) => string;
  patchChat: (treeId: string, turnId: string, patch: Partial<ChatTurn>) => void;
  clearChat: (treeId: string) => void;

  importData: (d: Omit<Data, "ui">) => void;
  resetToSample: () => void;
}

const initialUI: UIState = { theme: "system", sidebarOpen: true, drawer: null, focus: false, paletteOpen: false, coachStep: 0, pendingQuote: null, pendingAsk: null, lastSavedAt: 0, reader: null, popup: null };

export const sampleData = (): Omit<Data, "ui"> => ({
  trees: sampleTrees,
  nodes: Object.fromEntries(sampleNodes.map((n) => [n.id, n])),
  docs: Object.fromEntries(sampleDocs.map((d) => [d.id, d])),
  topics: sampleTopics,
  highlights: [],
  chats: {},
});

/** Would giving `id` these parents create a loop (a topic inside itself)? */
export function wouldCycle(topics: Topic[], id: string, parentIds: string[]): boolean {
  const byId = Object.fromEntries(topics.map((t) => [t.id, t]));
  const stack = [...parentIds];
  const seen = new Set<string>();
  while (stack.length) {
    const p = stack.pop()!;
    if (p === id) return true;
    if (seen.has(p)) continue;
    seen.add(p);
    stack.push(...(byId[p]?.parentIds || []));
  }
  return false;
}

/** Is this tree locked? Locked trees refuse every change except unlocking and reading history. */
export const isLocked = (trees: Tree[], treeId: string | undefined) => !!treeId && !!trees.find((t) => t.id === treeId)?.locked;
const nodeLocked = (s: Data, nodeId: string) => isLocked(s.trees, s.nodes[nodeId]?.treeId);
/** Patches a locked tree still accepts: unlocking, and when it was last opened. */
const LOCKED_TREE_KEYS = new Set(["locked", "lastOpenedAt"]);

const touch = (trees: Tree[], id: string) => trees.map((t) => (t.id === id ? { ...t, updatedAt: Date.now() } : t));

export const useStore = create<Data & Actions>()(
  persist(
    (set, get) => ({
      ...sampleData(),
      ui: initialUI,

      setUI: (patch) => set((s) => ({ ui: { ...s.ui, ...patch } })),

      createTree: (seed) => {
        const treeId = uid("tr"), seedId = uid("n"), now = Date.now();
        const node: TreeNode = seed.kind === "source"
          ? { id: seedId, treeId, kind: "source", title: seed.doc.title, parentId: null, anchors: [], docId: seed.doc.id, createdAt: now }
          : { id: seedId, treeId, kind: "note", title: seed.title, parentId: null, anchors: [], body: seed.body, createdAt: now };
        const tree: Tree = { id: treeId, title: seed.title || node.title, seedId, topicIds: seed.topicIds || [], understanding: "", trails: [], createdAt: now, updatedAt: now, lastOpenedAt: now };
        set((s) => ({
          trees: [tree, ...s.trees],
          nodes: { ...s.nodes, [seedId]: node },
          docs: seed.kind === "source" ? { ...s.docs, [seed.doc.id]: seed.doc } : s.docs,
        }));
        return treeId;
      },
      updateTree: (id, patch) => set((s) => (isLocked(s.trees, id) && Object.keys(patch).some((k) => !LOCKED_TREE_KEYS.has(k)) ? {} : { trees: s.trees.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t)) })),
      deleteTree: (id) => set((s) => {
        if (isLocked(s.trees, id)) return {};
        const nodes = Object.fromEntries(Object.entries(s.nodes).filter(([, n]) => n.treeId !== id));
        const gone = new Set(Object.values(s.nodes).filter((n) => n.treeId === id).map((n) => n.id));
        const docIds = new Set(Object.values(nodes).map((n) => n.docId).filter(Boolean));
        return {
          trees: s.trees.filter((t) => t.id !== id),
          nodes,
          docs: Object.fromEntries(Object.entries(s.docs).filter(([k]) => docIds.has(k))),
          highlights: s.highlights.filter((h) => !gone.has(h.nodeId)),
          chats: Object.fromEntries(Object.entries(s.chats).filter(([k]) => k !== id)),
        };
      }),
      recordTrail: (treeId, nodeIds) => set((s) => ({
        trees: s.trees.map((t) => {
          if (t.id !== treeId) return t;
          const key = nodeIds.join(",");
          const rest = t.trails.filter((x) => x.nodeIds.join(",") !== key && !(key.startsWith(x.nodeIds.join(",") + ",")));
          const trail: Trail = { id: uid("trail"), nodeIds, openedAt: Date.now() };
          return { ...t, trails: nodeIds.length > 1 ? [trail, ...rest].slice(0, 12) : t.trails, lastOpenedAt: Date.now() };
        }),
      })),

      addBranch: (treeId, b) => {
        const id = uid("n");
        if (isLocked(get().trees, treeId)) return id;
        const { doc, ...rest } = b;
        set((s) => ({
          nodes: { ...s.nodes, [id]: { ...rest, id, treeId, createdAt: Date.now() } },
          docs: doc ? { ...s.docs, [doc.id]: doc } : s.docs,
          trees: touch(s.trees, treeId),
        }));
        return id;
      },
      updateNode: (id, patch) => set((s) => (s.nodes[id] && !nodeLocked(s, id) ? { nodes: { ...s.nodes, [id]: { ...s.nodes[id], ...patch, updatedAt: Date.now() } } } : {})),
      removeNode: (id) => set((s) => {
        if (nodeLocked(s, id)) return {};
        const all = Object.values(s.nodes);
        const gone = new Set([id, ...descendants(all, id)]);
        const nodes = Object.fromEntries(Object.entries(s.nodes).filter(([k]) => !gone.has(k)));
        const docIds = new Set(Object.values(nodes).map((n) => n.docId).filter(Boolean));
        const treeId = s.nodes[id]?.treeId;
        return {
          nodes,
          docs: Object.fromEntries(Object.entries(s.docs).filter(([k]) => docIds.has(k))),
          highlights: s.highlights.filter((h) => !gone.has(h.nodeId)),
          trees: s.trees.map((t) => (t.id === treeId ? { ...t, trails: t.trails.filter((tr) => !tr.nodeIds.some((n) => gone.has(n))), updatedAt: Date.now() } : t)),
        };
      }),
      addAnchor: (id, anchor) => set((s) => {
        const n = s.nodes[id];
        if (!n || nodeLocked(s, id) || n.anchors.some((a) => a.blockId === anchor.blockId && a.start === anchor.start)) return {};
        return { nodes: { ...s.nodes, [id]: { ...n, anchors: [...n.anchors, anchor], marginY: undefined } } };
      }),

      addHighlight: (nodeId, anchor) => {
        const id = uid("hl");
        set((s) => (nodeLocked(s, nodeId) ? {} : { highlights: [...s.highlights, { id, nodeId, anchor, createdAt: Date.now() }] }));
        return id;
      },
      updateHighlight: (id, anchor) => set((s) => {
        const h = s.highlights.find((x) => x.id === id);
        return !h || nodeLocked(s, h.nodeId) ? {} : { highlights: s.highlights.map((x) => (x.id === id ? { ...x, anchor } : x)) };
      }),
      removeHighlight: (id) => set((s) => {
        const h = s.highlights.find((x) => x.id === id);
        return !h || nodeLocked(s, h.nodeId) ? {} : { highlights: s.highlights.filter((x) => x.id !== id) };
      }),

      addTopic: (name, parentIds = []) => {
        const existing = get().topics.find((t) => t.name.toLowerCase() === name.trim().toLowerCase());
        if (existing) return existing.id;
        const id = uid("t");
        set((s) => ({ topics: [...s.topics, { id, name: name.trim(), parentIds, createdAt: Date.now() }] }));
        return id;
      },
      updateTopic: (id, patch) => set((s) => {
        if (patch.parentIds && wouldCycle(s.topics, id, patch.parentIds)) return {};
        return { topics: s.topics.map((t) => (t.id === id ? { ...t, ...patch } : t)) };
      }),
      deleteTopic: (id) => set((s) => ({
        topics: s.topics.filter((t) => t.id !== id).map((t) => ({ ...t, parentIds: t.parentIds.filter((p) => p !== id) })),
        trees: s.trees.map((t) => ({ ...t, topicIds: t.topicIds.filter((x) => x !== id) })),
      })),

      pushChat: (treeId, turn) => {
        const id = uid("t");
        set((s) => ({ chats: { ...s.chats, [treeId]: [...(s.chats[treeId] || []), { ...turn, id, createdAt: Date.now() }] } }));
        return id;
      },
      patchChat: (treeId, turnId, patch) => set((s) => ({ chats: { ...s.chats, [treeId]: (s.chats[treeId] || []).map((t) => (t.id === turnId ? { ...t, ...patch } : t)) } })),
      clearChat: (treeId) => set((s) => ({ chats: { ...s.chats, [treeId]: [] } })),

      importData: (d) => set(() => ({ ...d })),
      resetToSample: () => set((s) => ({ ...sampleData(), ui: { ...initialUI, theme: s.ui.theme } })),
    }),
    {
      name: "reading-desk-v2",
      version: 2,
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({
        trees: s.trees, nodes: Object.fromEntries(Object.entries(s.nodes).map(([k, n]) => [k, { ...n, pending: undefined, error: undefined }])),
        docs: s.docs, topics: s.topics, highlights: s.highlights, chats: s.chats,
        ui: { ...s.ui, paletteOpen: false, pendingQuote: null, pendingAsk: null, drawer: null, reader: null, popup: null, jumpTo: null },
      }),
    },
  ),
);

/** Record when data was last written, for the "Saved" indicator. */
useStore.subscribe((s, prev) => {
  if (s.trees !== prev.trees || s.nodes !== prev.nodes || s.docs !== prev.docs || s.topics !== prev.topics || s.highlights !== prev.highlights) {
    queueMicrotask(() => useStore.setState((x) => ({ ui: { ...x.ui, lastSavedAt: Date.now() } })));
  }
});

export const useTree = (id?: string) => useStore((s) => s.trees.find((t) => t.id === id));
