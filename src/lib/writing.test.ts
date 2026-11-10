import { describe, expect, it } from "vitest";
import { appendCite, appendExcerpt, citeLink, citesIn, parseCite, quoteBlock } from "./writing";

const a = { docId: "n1", blockId: "b-2", start: 0, end: 5, quote: "Hands [know] things", page: 3 };

describe("passage links in writing", () => {
  it("writes a readable Markdown link", () => expect(citeLink(a)).toBe("[“Hands know things”](#cite:n1/b-2)"));
  it("finds links in order", () => {
    const text = appendCite("My thought.", a) + "and " + citeLink({ ...a, docId: "n2", blockId: "x" });
    expect(citesIn(text).map((c) => c.nodeId)).toEqual(["n1", "n2"]);
    expect(text.startsWith("My thought.\n\n[")).toBe(true);
  });
  it("parses an address", () => {
    expect(parseCite("#cite:n1/b-2")).toEqual({ nodeId: "n1", blockId: "b-2" });
    expect(parseCite("https://x.org")).toBeNull();
  });
  it("adds an excerpt as a quotation linked to its source", () => {
    const text = appendExcerpt("Draft.", a, { title: "The [Dark] Side", site: "Little Almanack" });
    expect(text).toBe("Draft.\n\n> Hands [know] things\n> — *from [The Dark Side](#cite:n1/b-2), Little Almanack, p. 3*\n\n");
    expect(citesIn(text)).toEqual([{ label: "The Dark Side", nodeId: "n1", blockId: "b-2" }]);
  });
  it("reads a quotation back as page text: the quote, then its italic source with the title linked", () => {
    const md = appendExcerpt("", a, { title: "The Side", site: "Almanack" });
    const q = quoteBlock(md)!;
    expect(q.text).toBe("“Hands [know] things”\n— from The Side, Almanack, p. 3");
    expect(q.text.slice(q.attrib)).toBe("— from The Side, Almanack, p. 3");
    expect(q.text.slice(q.link.start, q.link.end)).toBe("The Side");
    expect(q.link.href).toBe("#cite:n1/b-2");
    expect(quoteBlock("Just a paragraph.")).toBeNull();
  });
});
