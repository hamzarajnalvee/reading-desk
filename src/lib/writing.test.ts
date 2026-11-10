import { describe, expect, it } from "vitest";
import { appendCite, appendExcerpt, citeLink, citesIn, parseCite } from "./writing";

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
    const text = appendExcerpt("Draft.", a, "The [Dark] Side");
    expect(text).toBe("Draft.\n\n> Hands [know] things\n> — [The Dark Side](#cite:n1/b-2)\n\n");
    expect(citesIn(text)).toEqual([{ label: "The Dark Side", nodeId: "n1", blockId: "b-2" }]);
  });
});
