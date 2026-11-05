import { describe, expect, it } from "vitest";
import { bodyBlocks, bodyOffset, contentOf, descendants, mapNodes, pathTo } from "./content";
import { reanchor, resolveRange } from "./anchors";
import type { Doc, TreeNode } from "../data/types";

const n = (id: string, parentId: string | null, extra: Partial<TreeNode> = {}): TreeNode => ({ id, treeId: "t", kind: "note", title: id, parentId, anchors: [], createdAt: 0, ...extra });

describe("bodyBlocks", () => {
  it("splits paragraphs, keeps headings, and gives stable ids", () => {
    const b = bodyBlocks("x", "# Title\n\nFirst para\nwraps here.\n\nSecond.");
    expect(b.map((x) => [x.id, x.kind, x.text])).toEqual([["x-p1", "h", "Title"], ["x-p2", "p", "First para wraps here."], ["x-p3", "p", "Second."]]);
  });
  it("drops Markdown emphasis so offsets match what's shown", () => {
    expect(bodyBlocks("x", "Came up in *Fooled by Randomness* and **mattered**.")[0].text).toBe("Came up in Fooled by Randomness and mattered.");
  });
});

describe("contentOf", () => {
  const doc: Doc = { id: "d", title: "Doc title", type: "web", format: "web", pages: 1, addedAt: 0, blocks: [{ id: "d-b1", kind: "p", page: 1, text: "Hello." }] };
  it("uses the doc for sources and the body for notes", () => {
    expect(contentOf(n("s", null, { kind: "source", docId: "d" }), { d: doc })).toMatchObject({ id: "s", title: "Doc title", blocks: doc.blocks });
    expect(contentOf(n("a", null, { body: "Idea." }), {}).blocks[0]).toMatchObject({ id: "a-p1", text: "Idea." });
  });
  it("shows a clipping's text and the note on it", () => {
    const c = contentOf(n("c", null, { kind: "clipping", clip: { text: "Quoted.", source: {} }, body: "Mine." }), {});
    expect(c.blocks.map((b) => b.text)).toEqual(["Quoted.", "Mine."]);
  });
});

describe("tree walking", () => {
  const nodes = [n("a", null), n("b", "a"), n("c", "b"), n("d", "a")];
  const map = Object.fromEntries(nodes.map((x) => [x.id, x]));
  it("pathTo returns the chain from the seed", () => { expect(pathTo(map, "c")).toEqual(["a", "b", "c"]); });
  it("descendants finds every branch below a node", () => { expect(descendants(nodes, "a").sort()).toEqual(["b", "c", "d"]); expect(descendants(nodes, "c")).toEqual([]); });
});

describe("resolveRange", () => {
  const block = { id: "b", kind: "p" as const, page: 1, text: "Edited: the kappa operator is a contraction." };
  it("trusts offsets when the text still matches", () => {
    const i = block.text.indexOf("kappa");
    expect(resolveRange(block, { docId: "x", blockId: "b", start: i, end: i + 5, quote: "kappa", page: 1 })).toEqual([i, i + 5]);
  });
  it("finds the quote again after the text was edited", () => {
    expect(resolveRange(block, { docId: "x", blockId: "b", start: 0, end: 5, quote: "kappa", page: 1 })).toEqual([12, 17]);
  });
  it("returns null when the quote is gone", () => {
    expect(resolveRange(block, { docId: "x", blockId: "b", start: 0, end: 5, quote: "omega", page: 1 })).toBeNull();
  });
});

describe("bodyOffset", () => {
  const body = "# Heading\n\nFirst paragraph here.\n\n\nSecond one.";
  it("maps a paragraph and offset to a position in the raw body", () => {
    const at = bodyOffset(body, 1, 6);
    expect(body.slice(at)).toBe("paragraph here.\n\n\nSecond one.");
    expect(body.slice(bodyOffset(body, 2, 0))).toBe("Second one.");
  });
  it("skips the Markdown heading marker", () => {
    expect(body.slice(bodyOffset(body, 0, 0))).toMatch(/^Heading/);
  });
  it("clamps to the paragraph, and falls back to the end", () => {
    expect(bodyOffset(body, 1, 999)).toBe(body.indexOf("here.") + 5);
    expect(bodyOffset(body, 9, 0)).toBe(body.length);
  });
  it("agrees with bodyBlocks on paragraph numbering", () => {
    const b = bodyBlocks("n", body);
    expect(b.map((x) => x.text)).toEqual(["Heading", "First paragraph here.", "Second one."]);
  });
});

describe("reanchor", () => {
  const anchor = { docId: "n", blockId: "n-p1", start: 0, end: 5, quote: "First", page: 1 };
  it("keeps an anchor whose words haven't moved", () => {
    expect(reanchor(bodyBlocks("n", "First words."), anchor)).toBe(anchor);
  });
  it("follows words that moved within the paragraph", () => {
    expect(reanchor(bodyBlocks("n", "The First words."), anchor)).toMatchObject({ blockId: "n-p1", start: 4, end: 9 });
  });
  it("follows words into another paragraph when one is added above", () => {
    expect(reanchor(bodyBlocks("n", "New opening.\n\nFirst words."), anchor)).toMatchObject({ blockId: "n-p2", start: 0, end: 5 });
  });
  it("leaves the anchor as it was when the words are gone", () => {
    expect(reanchor(bodyBlocks("n", "Something else."), anchor)).toBe(anchor);
  });
});

describe("mapNodes", () => {
  const n = (id: string, kind: TreeNode["kind"], parentId: string | null) => ({ id, kind, parentId, treeId: "t", title: id, anchors: [], createdAt: 0 }) as TreeNode;
  const all = [n("seed", "source", null), n("note", "note", "seed"), n("grown", "note", "seed"), n("src", "source", "grown"), n("def", "definition", "src")];
  it("keeps the seed, sources and anything that grew branches; leaves margin notes off", () => {
    expect(mapNodes(all, "seed").map((x) => x.id)).toEqual(["seed", "grown", "src"]);
  });
  it("keeps what's on the open trail, and shows everything when asked", () => {
    expect(mapNodes(all, "seed", new Set(["note"])).map((x) => x.id)).toContain("note");
    expect(mapNodes(all, "seed", new Set(), true)).toHaveLength(5);
  });
});
