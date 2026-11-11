import { beforeEach, describe, expect, it, vi } from "vitest";

// jsdom has no IndexedDB: keep persistence in memory for these tests.
vi.mock("idb-keyval", () => { const m = new Map<string, unknown>(); return { get: async (k: string) => m.get(k), set: async (k: string, v: unknown) => { m.set(k, v); }, del: async (k: string) => { m.delete(k); } }; });

const { useStore, wouldCycle } = await import("./useStore");
const S = () => useStore.getState();
const anchor = (docId: string, quote = "x") => ({ docId, blockId: `${docId}-p1`, start: 0, end: quote.length, quote, page: 1 });

describe("trees and branches", () => {
  beforeEach(() => S().resetToSample());

  it("moves and removes a branch's links, keeping an unlinked branch in the margin", () => {
    const id = S().addBranch("tr-payments", { kind: "note", title: "N", parentId: "n-stripe", anchors: [anchor("n-stripe", "a"), anchor("n-stripe", "b")], body: "" });
    S().replaceAnchor(id, 1, anchor("n-stripe", "c"));
    expect(S().nodes[id].anchors.map((a) => a.quote)).toEqual(["a", "c"]);
    S().removeAnchor(id, 0);
    expect(S().nodes[id].anchors.map((a) => a.quote)).toEqual(["c"]);
    S().removeAnchor(id, 0, 240);
    expect(S().nodes[id]).toMatchObject({ anchors: [], marginY: 240 });
  });

  it("starts a tree from an idea", () => {
    const id = S().createTree({ kind: "note", title: "Syllogisms", body: "All men are mortal." });
    const tree = S().trees.find((t) => t.id === id)!;
    expect(S().nodes[tree.seedId]).toMatchObject({ kind: "note", parentId: null, body: "All men are mortal." });
    expect(S().trees[0].id).toBe(id);
  });

  it("adds a source branch with its document", () => {
    const tid = S().createTree({ kind: "note", title: "T", body: "Seed text." });
    const seed = S().trees[0].seedId;
    const doc = { id: "doc-x", title: "Paper", type: "paper" as const, format: "pdf" as const, pages: 1, blocks: [], addedAt: 0 };
    const b = S().addBranch(tid, { kind: "source", title: "Paper", parentId: seed, anchors: [anchor(seed)], docId: "doc-x", doc });
    expect(S().nodes[b].docId).toBe("doc-x");
    expect(S().docs["doc-x"].title).toBe("Paper");
  });

  it("removes a branch with everything that grew from it, its documents, highlights and trails", () => {
    S().addHighlight("n-pci", anchor("n-pci"));
    S().removeNode("n-primer");
    for (const id of ["n-primer", "n-interchange", "n-cap", "n-pci", "n-scope", "n-3ds", "n-frictionless", "n-chargeback"]) expect(S().nodes[id]).toBeUndefined();
    expect(S().nodes["n-stripe"]).toBeDefined();
    expect(S().nodes["n-token"]).toBeDefined();
    expect(S().docs["d-pci"]).toBeUndefined();
    expect(S().docs["d-stripe"]).toBeDefined();
    expect(S().highlights.some((h) => h.nodeId === "n-pci")).toBe(false);
    expect(S().trees.find((t) => t.id === "tr-payments")!.trails).toEqual([]);
  });

  it("records trails most recent first, replacing shorter versions of the same path", () => {
    S().recordTrail("tr-payments", ["n-stripe", "n-primer"]);
    S().recordTrail("tr-payments", ["n-stripe", "n-primer", "n-pci"]);
    S().recordTrail("tr-payments", ["n-stripe", "n-token"]);
    const trails = S().trees.find((t) => t.id === "tr-payments")!.trails.map((t) => t.nodeIds.join(">"));
    expect(trails[0]).toBe("n-stripe>n-token");
    expect(trails).toContain("n-stripe>n-primer>n-pci");
    expect(trails).not.toContain("n-stripe>n-primer");
  });

  it("deleting a tree removes its branches and documents", () => {
    S().deleteTree("tr-payments");
    expect(Object.values(S().nodes).some((n) => n.treeId === "tr-payments")).toBe(false);
    expect(S().docs["d-stripe"]).toBeUndefined();
    expect(S().trees.map((t) => t.id)).toEqual(["tr-telos"]);
  });
});

describe("topics", () => {
  beforeEach(() => S().resetToSample());

  it("lets a topic sit under several parents", () => {
    expect(S().topics.find((t) => t.id === "t-logic")!.parentIds).toEqual(["t-philosophy", "t-cs"]);
  });
  it("reuses an existing topic with the same name", () => {
    expect(S().addTopic("logic")).toBe("t-logic");
  });
  it("refuses to put a topic inside itself", () => {
    expect(wouldCycle(S().topics, "t-philosophy", ["t-syllogistic"])).toBe(true);
    S().updateTopic("t-philosophy", { parentIds: ["t-syllogistic"] });
    expect(S().topics.find((t) => t.id === "t-philosophy")!.parentIds).toEqual([]);
    expect(wouldCycle(S().topics, "t-syllogistic", ["t-cs"])).toBe(false);
  });
  it("deleting a topic removes it from trees and from other topics' parents", () => {
    S().deleteTopic("t-payments");
    expect(S().topics.find((t) => t.id === "t-cardsec")!.parentIds).toEqual(["t-security"]);
    expect(S().trees.find((t) => t.id === "tr-payments")!.topicIds).toEqual(["t-cardsec"]);
  });
});

describe("locked trees", () => {
  beforeEach(() => S().resetToSample());
  const lock = () => S().updateTree("tr-payments", { locked: true });

  it("refuse changes to the tree, its branches and highlights", () => {
    const hl = S().addHighlight("n-stripe", anchor("n-stripe"));
    lock();
    const before = { trees: S().trees, nodes: S().nodes, highlights: S().highlights };
    S().updateTree("tr-payments", { title: "Renamed", understanding: "x", topicIds: [] });
    S().addBranch("tr-payments", { kind: "note", title: "N", parentId: "n-stripe", anchors: [anchor("n-stripe")], body: "" });
    S().updateNode("n-token", { body: "changed" });
    S().removeNode("n-primer");
    S().addAnchor("n-token", anchor("n-stripe", "other"));
    S().removeAnchor("n-token", 0);
    S().replaceAnchor("n-token", 0, anchor("n-stripe", "moved"));
    S().addHighlight("n-stripe", anchor("n-stripe", "y"));
    S().updateHighlight(hl, anchor("n-stripe", "z"));
    S().removeHighlight(hl);
    S().deleteTree("tr-payments");
    expect(S().trees).toBe(before.trees);
    expect(S().nodes).toBe(before.nodes);
    expect(S().highlights).toBe(before.highlights);
  });

  it("still record reading history, and can be unlocked", () => {
    lock();
    S().recordTrail("tr-payments", ["n-stripe", "n-primer"]);
    expect(S().trees.find((t) => t.id === "tr-payments")!.trails[0].nodeIds).toEqual(["n-stripe", "n-primer"]);
    S().updateTree("tr-payments", { locked: false });
    S().updateNode("n-token", { body: "changed" });
    expect(S().nodes["n-token"].body).toBe("changed");
  });

  it("leave other trees alone", () => {
    lock();
    S().updateNode("n-telos", { body: "New" });
    expect(S().nodes["n-telos"].body).toBe("New");
  });
});
