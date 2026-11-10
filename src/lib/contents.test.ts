import { describe, expect, it } from "vitest";
import type { Block, TocEntry } from "../data/types";
import { contentsLinks, contentsOf, currentEntry } from "./contents";

const b = (id: string, kind: "h" | "p", text: string): Block => ({ id, kind, text, page: 1 });
const long = "Text of the chapter. ".repeat(12);

describe("contentsOf", () => {
  it("uses the source's own contents when it has them", () => {
    const toc: TocEntry[] = [{ title: "One", blockId: "a", level: 1 }, { title: "Two", blockId: "b", level: 1 }];
    expect(contentsOf({ toc, blocks: [] })).toBe(toc);
  });
  it("falls back to headings, counting a heading listed on the contents page once, where its text starts", () => {
    const blocks = [
      b("t1", "h", "1. Introduction"), b("t2", "h", "2. Methods"),
      b("c1", "h", "1. Introduction"), b("c1p", "p", long),
      b("c2", "h", "2. Methods"), b("c2p", "p", long),
    ];
    expect(contentsOf({ blocks }).map((t) => t.blockId)).toEqual(["c1", "c2"]);
  });
  it("shows no contents for a source with a single heading", () => {
    expect(contentsOf({ blocks: [b("h", "h", "Only"), b("p", "p", long)] })).toEqual([]);
  });
});

describe("contentsLinks", () => {
  const blocks = [
    b("toc", "p", "Contents Chapter 1 The Market .......... 3 Chapter 2 Starting Out .......... 9"),
    b("c1", "h", "The Market"), b("c1p", "p", long),
    b("c2", "h", "Starting Out"), b("c2p", "p", long),
  ];
  const toc: TocEntry[] = [{ title: "The Market", blockId: "c1", level: 1 }, { title: "Starting Out", blockId: "c2", level: 1 }];

  it("links each title on the printed contents page to its part, without changing the words", () => {
    const links = contentsLinks(blocks, toc);
    expect(links.map((l) => [blocks[0].text.slice(l.start, l.end), l.target])).toEqual([["The Market", "c1"], ["Starting Out", "c2"]]);
  });
  it("only links whole words", () => {
    const art: TocEntry[] = [{ title: "Art", blockId: "c1", level: 1 }, { title: "Starting Out", blockId: "c2", level: 1 }];
    const links = contentsLinks([b("toc", "p", "Start here. Starting Out"), ...blocks.slice(1)], art);
    expect(links.map((l) => l.target)).toEqual(["c2"]);
  });
  it("leaves the text after the first part alone", () => {
    expect(contentsLinks(blocks, toc).every((l) => l.blockId === "toc")).toBe(true);
  });
});

describe("currentEntry", () => {
  it("is the last part that starts at or before the block being read", () => {
    const blocks = [b("a", "h", "A"), b("a1", "p", "x"), b("b", "h", "B"), b("b1", "p", "y")];
    const toc: TocEntry[] = [{ title: "A", blockId: "a", level: 1 }, { title: "B", blockId: "b", level: 1 }];
    expect(currentEntry(blocks, toc, "a1")).toBe("a");
    expect(currentEntry(blocks, toc, "b1")).toBe("b");
  });
});
