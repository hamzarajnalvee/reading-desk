import { describe, expect, it } from "vitest";
import type { Topic, Tree, TreeNode } from "../data/types";
import { applyToState, emptyMeta, markPushed, mergeRemote, outgoing, pullSince, reconcile, toTables, trackChanges, type Row } from "./syncMerge";

const tree = (id: string, title = id, updatedAt = 1): Tree => ({ id, title, seedId: `${id}-seed`, topicIds: [], understanding: "", trails: [], createdAt: 1, updatedAt });
const node = (id: string, extra: Partial<TreeNode> = {}): TreeNode => ({ id, treeId: "t1", kind: "note", title: id, parentId: null, anchors: [], body: "b", createdAt: 1, ...extra });
const topic = (id: string): Topic => ({ id, name: id, parentIds: [], createdAt: 1 });
const state = (o: { trees?: Tree[]; nodes?: TreeNode[]; topics?: Topic[] } = {}) => ({
  trees: o.trees ?? [], nodes: Object.fromEntries((o.nodes ?? []).map((n) => [n.id, n])), docs: {}, topics: o.topics ?? [], highlights: [],
});
const row = (id: string, updated_at: number, data: unknown, deleted = false): Row => ({ id, data, updated_at, deleted });

describe("tracking local changes", () => {
  it("marks new, changed and removed records to push", () => {
    const a = tree("a"), b = tree("b");
    const prev = toTables(state({ trees: [a, b] }));
    const next = toTables(state({ trees: [{ ...a, title: "A2" }, tree("c")] }));
    const m = trackChanges(prev, next, emptyMeta(), 100);
    expect(m.trees.a).toEqual({ at: 100, dirty: true });
    expect(m.trees.c).toEqual({ at: 100, dirty: true });
    expect(m.trees.b).toEqual({ at: 100, deleted: true, dirty: true });
  });

  it("ignores changes to pending and error, which never sync", () => {
    const n = node("n1");
    const m = trackChanges(toTables(state({ nodes: [n] })), toTables(state({ nodes: [{ ...n, pending: true }] })), emptyMeta(), 100);
    expect(m.nodes.n1).toBeUndefined();
  });

  it("always moves a record's time forward, even when this device's clock is behind", () => {
    const a = tree("a");
    const meta = { ...emptyMeta(), trees: { a: { at: 500 } } };
    const m = trackChanges(toTables(state({ trees: [a] })), toTables(state({ trees: [{ ...a, title: "x" }] })), meta, 100);
    expect(m.trees.a.at).toBe(501);
  });

  it("on first load, marks unsynced records to push and turns vanished ones into deletions", () => {
    const meta = { ...emptyMeta(), trees: { gone: { at: 5 }, kept: { at: 5 } } };
    const m = reconcile(toTables(state({ trees: [tree("kept"), tree("new", "new", 42)] })), meta, 900);
    expect(m.trees.new).toEqual({ at: 42, dirty: true });
    expect(m.trees.kept).toEqual({ at: 5 });
    expect(m.trees.gone).toEqual({ at: 900, deleted: true, dirty: true });
  });
});

describe("merging remote rows (last write wins)", () => {
  it("takes a newer remote record", () => {
    const meta = { ...emptyMeta(), trees: { a: { at: 10 } } };
    const r = mergeRemote({ trees: [row("a", 20, tree("a", "remote"))] }, meta);
    expect(r.apply.trees.a).toMatchObject({ title: "remote" });
    expect(r.meta.trees.a).toEqual({ at: 20, deleted: undefined });
  });

  it("keeps a newer local change and still pushes it", () => {
    const meta = { ...emptyMeta(), trees: { a: { at: 30, dirty: true } } };
    const r = mergeRemote({ trees: [row("a", 20, tree("a", "remote"))] }, meta);
    expect(r.apply.trees).toEqual({});
    expect(r.meta.trees.a).toEqual({ at: 30, dirty: true });
    expect(outgoing(toTables(state({ trees: [tree("a", "local")] })), r.meta).trees).toEqual([row("a", 30, tree("a", "local"))]);
  });

  it("applies a remote deletion that is newer than the local edit", () => {
    const meta = { ...emptyMeta(), topics: { t: { at: 10, dirty: true } } };
    const r = mergeRemote({ topics: [row("t", 11, null, true)] }, meta);
    expect(r.apply.topics.t).toBeNull();
    expect(r.meta.topics.t.deleted).toBe(true);
  });

  it("skips rows it already has, such as its own pushes coming back", () => {
    const meta = { ...emptyMeta(), trees: { a: { at: 10 } } };
    expect(mergeRemote({ trees: [row("a", 10, tree("a"))] }, meta).apply.trees).toEqual({});
  });

  it("adds records it has never seen", () => {
    const r = mergeRemote({ nodes: [row("n9", 5, node("n9"))] }, emptyMeta());
    expect(r.apply.nodes.n9).toMatchObject({ id: "n9" });
  });
});

describe("pushing", () => {
  it("sends deletions as soft deletes and strips transient fields", () => {
    const meta = { ...emptyMeta(), nodes: { n1: { at: 3, dirty: true }, n2: { at: 4, deleted: true, dirty: true } } };
    const out = outgoing(toTables(state({ nodes: [node("n1", { pending: true, error: "x" })] })), meta).nodes;
    expect(out[0].data).not.toHaveProperty("pending");
    expect(out[0].data).not.toHaveProperty("error");
    expect(out[1]).toEqual(row("n2", 4, null, true));
  });

  it("clears dirty only if the record didn't change again during the push", () => {
    const meta = { ...emptyMeta(), trees: { a: { at: 3, dirty: true }, b: { at: 9, dirty: true } } };
    const pushed = { ...outgoing(toTables(state()), emptyMeta()), trees: [row("a", 3, {}), row("b", 5, {})] };
    const m = markPushed(meta, pushed);
    expect(m.trees.a.dirty).toBeUndefined();
    expect(m.trees.b.dirty).toBe(true);
  });
});

describe("applying to the store", () => {
  it("updates in place, removes deletions and puts new trees first", () => {
    const s = state({ trees: [tree("a"), tree("b")], topics: [topic("x")] });
    const apply = { trees: { a: tree("a", "A2"), b: null, c: tree("c") }, nodes: {}, docs: {}, topics: { y: topic("y") }, highlights: {} };
    const next = applyToState(s, apply);
    expect(next.trees.map((t) => [t.id, t.title])).toEqual([["c", "c"], ["a", "A2"]]);
    expect(next.topics.map((t) => t.id)).toEqual(["x", "y"]);
    expect(next.nodes).toBe(s.nodes);
  });
});

describe("pullSince", () => {
  it("starts from the beginning on the first pull", () => {
    expect(pullSince(undefined)).toBe("1970-01-01T00:00:00Z");
  });
  it("re-reads a window before the cursor so late commits aren't missed", () => {
    expect(pullSince("2026-11-05T10:00:00.123456+00:00", 120_000)).toBe("2026-11-05T09:58:00.123Z");
  });
  it("falls back to the beginning when the cursor can't be read", () => {
    expect(pullSince("not a time")).toBe("1970-01-01T00:00:00Z");
  });
  it("re-applying a row already pulled changes nothing", () => {
    const row: Row = { id: "t1", data: { id: "t1" }, updated_at: 5, deleted: false };
    const first = mergeRemote({ trees: [row] }, emptyMeta());
    const again = mergeRemote({ trees: [row] }, first.meta);
    expect(again.apply.trees).toEqual({});
  });
});
