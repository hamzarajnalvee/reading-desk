import { describe, expect, it } from "vitest";
import { layoutTree } from "./layout";
import type { TreeNode } from "../data/types";

const n = (id: string, parentId: string | null, t = 0): TreeNode => ({ id, treeId: "t", kind: "note", title: id, parentId, anchors: [], createdAt: t });

describe("layoutTree", () => {
  it("lays the tree out left to right from the seed", () => {
    const pts = layoutTree([n("s", null), n("a", "s", 1), n("b", "s", 2), n("c", "a", 3)], "s", 300, 100);
    const by = Object.fromEntries(pts.map((p) => [p.id, p]));
    expect(by.s.x).toBe(0);
    expect(by.a.x).toBe(300);
    expect(by.c.x).toBe(600);
    expect(by.a.y).not.toBe(by.b.y);
    expect(by.c.parentId).toBe("a");
  });
  it("ignores nodes that aren't connected to the seed", () => {
    expect(layoutTree([n("s", null), n("x", "missing")], "s").map((p) => p.id)).toEqual(["s"]);
  });
  it("returns nothing without a seed", () => { expect(layoutTree([n("a", "s")], "s")).toEqual([]); });
});
