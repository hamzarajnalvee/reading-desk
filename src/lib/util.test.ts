import { describe, expect, it } from "vitest";
import { hostOf, md, plural, sentenceAt, sentences } from "./util";

describe("md", () => {
  it("escapes HTML before formatting", () => {
    expect(md("<script>alert(1)</script>")).toBe("<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
  });
  it("keeps underscores inside inline code and URLs", () => {
    const out = md("Set `ANTHROPIC_API_KEY` and see [docs](https://a.b/c_d_e) for snake_case_names.");
    expect(out).toContain("<code>ANTHROPIC_API_KEY</code>");
    expect(out).toContain('href="https://a.b/c_d_e"');
    expect(out).toContain("snake_case_names");
    expect(out).not.toContain("<em>");
  });
  it("formats bold, italics, lists and quotes", () => {
    expect(md("**bold** and *it* and _also_")).toBe("<p><strong>bold</strong> and <em>it</em> and <em>also</em></p>");
    expect(md("- one\n- two")).toBe("<ul><li>one</li><li>two</li></ul>");
    expect(md("1. a\n2. b")).toBe("<ol><li>a</li><li>b</li></ol>");
    expect(md("> quoted")).toBe("<blockquote>quoted</blockquote>");
  });
  it("only links http(s) URLs", () => {
    expect(md("[x](javascript:alert(1))")).not.toContain("<a ");
  });
});

describe("sentences", () => {
  const text = "First sentence. Second one! Third? Trailing words";
  it("splits on terminal punctuation", () => {
    expect(sentences(text).map(([s, e]) => text.slice(s, e))).toEqual(["First sentence.", "Second one!", "Third?", "Trailing words"]);
  });
  it("finds the sentence around an offset", () => {
    const [s, e] = sentenceAt(text, text.indexOf("one"));
    expect(text.slice(s, e)).toBe("Second one!");
  });
  it("treats text without punctuation as one sentence", () => {
    expect(sentences("no punctuation here")).toEqual([[0, 19]]);
  });
});

describe("small helpers", () => {
  it("hostOf strips www and survives bad input", () => {
    expect(hostOf("https://www.example.com/a")).toBe("example.com");
    expect(hostOf("not a url")).toBe("");
    expect(hostOf(undefined)).toBe("");
  });
  it("plural", () => {
    expect(plural(1, "note")).toBe("1 note");
    expect(plural(3, "note")).toBe("3 notes");
  });
});
