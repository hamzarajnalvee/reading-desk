import { describe, expect, it } from "vitest";
import type { TreeNode } from "../data/types";
import { trackOf, tracksOf } from "./tracks";

const n = (id: string, kind: TreeNode["kind"], parentId: string | null, extra: Partial<TreeNode> = {}): TreeNode =>
  ({ id, treeId: "t", kind, title: id, parentId, anchors: [], createdAt: 0, ...extra });

describe("trackOf", () => {
  const nodes = Object.fromEntries([
    n("seed", "note", null),
    n("paper", "source", "seed"),
    n("def", "definition", "paper"),
    n("deep", "source", "def"),
    n("mine", "note", "paper"),
    n("set", "definition", "seed", { track: "essay" }),
    n("under", "source", "set"),
  ].map((x) => [x.id, x]));

  it("gives the seed no track", () => expect(trackOf(nodes.seed, nodes)).toBeNull());
  it("treats sources and notes as essay material", () => {
    expect(trackOf(nodes.paper, nodes)).toBe("essay");
    expect(trackOf(nodes.mine, nodes)).toBe("essay");
  });
  it("treats definitions and what grows from them as rabbit holes", () => {
    expect(trackOf(nodes.def, nodes)).toBe("rabbit");
    expect(trackOf(nodes.deep, nodes)).toBe("rabbit");
  });
  it("lets a track you set win, and pass to its branches", () => {
    expect(trackOf(nodes.set, nodes)).toBe("essay");
    expect(trackOf(nodes.under, nodes)).toBe("essay");
  });
  it("works out a whole tree", () => expect(tracksOf(nodes, "t").deep).toBe("rabbit"));
});
