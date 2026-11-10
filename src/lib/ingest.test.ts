import { describe, expect, it } from "vitest";
import { ingestFile, ingestText, IngestError, linesToParas } from "./ingest";

const file = (name: string, text: string) => new File([text], name, { type: "text/plain" });

describe("linesToParas", () => {
  it("joins hard-wrapped lines and de-hyphenates", () => {
    const text = "This is a long line that wraps across the page and keeps going\nonto the next line with a hyphen-\nated word.\n\nNew paragraph.";
    expect(linesToParas(text)).toEqual([
      "This is a long line that wraps across the page and keeps going onto the next line with a hyphenated word.",
      "New paragraph.",
    ]);
  });
});

describe("ingestText", () => {
  it("creates a document with blocks and pages", () => {
    const d = ingestText("My notes", "First paragraph.\n\nSecond paragraph.");
    expect(d.title).toBe("My notes");
    expect(d.format).toBe("paste");
    expect(d.blocks.map((b) => b.text)).toEqual(["First paragraph.", "Second paragraph."]);
    expect(d.blocks.every((b) => b.id.startsWith(d.id))).toBe(true);
    expect(d.pages).toBe(1);
  });
  it("uses the first line as the title when none is given", () => {
    expect(ingestText("", "Why drawdowns matter\n\nBody.").title).toBe("Why drawdowns matter");
  });
  it("splits long text into pseudo-pages so citations work", () => {
    const para = "word ".repeat(200).trim() + ".";
    const d = ingestText("Long", Array(10).fill(para).join("\n\n"));
    expect(d.pages).toBeGreaterThan(2);
  });
  it("rejects empty text", () => {
    expect(() => ingestText("x", "   ")).toThrow(IngestError);
  });
});

describe("ingestFile", () => {
  it("reads Markdown headings and uses the first as the title", async () => {
    const d = await ingestFile(file("notes.md", "# Drawdown notes\n\nIntro text.\n\n## Method\n\nMore text."));
    expect(d.title).toBe("Drawdown notes");
    expect(d.format).toBe("md");
    expect(d.blocks.map((b) => [b.kind, b.text])).toEqual([["h", "Drawdown notes"], ["p", "Intro text."], ["h", "Method"], ["p", "More text."]]);
  });
  it("reads plain text and guesses an article", async () => {
    const d = await ingestFile(file("essay.txt", "A short essay.\n\nWith two paragraphs."));
    expect(d.title).toBe("essay");
    expect(d.type).toBe("article");
  });
  it("recognises an annual report", async () => {
    const d = await ingestFile(file("halden.txt", "Halden Group plc Annual Report 2025\n\nStrategic report and financial statements."));
    expect(d.type).toBe("report");
  });
  it("reads HTML and drops scripts and navigation", async () => {
    const html = "<html><head><title>An article</title></head><body><nav>Menu</nav><article><h1>Heading</h1><p>Body text.</p><script>bad()</script></article></body></html>";
    const d = await ingestFile(new File([html], "page.html", { type: "text/html" }));
    expect(d.title).toBe("An article");
    expect(d.blocks.map((b) => b.text)).toEqual(["Heading", "Body text."]);
  });
  it("refuses unsupported office formats with a helpful message", async () => {
    await expect(ingestFile(file("deck.pptx", "x"))).rejects.toThrow(/PDF or .docx/);
  });
  it("refuses binary data posing as text", async () => {
    await expect(ingestFile(file("data.txt", "abc\u0000def"))).rejects.toThrow(/binary/);
  });
});

describe("EPUB contents", () => {
  async function epub(files: Record<string, string>) {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    Object.entries(files).forEach(([k, v]) => zip.file(k, v));
    const data = await zip.generateAsync({ type: "arraybuffer" });
    return new File([data], "book.epub", { type: "application/epub+zip" });
  }
  const chapter = (title: string) => `<html><body><h1>${title}</h1><p>${"Words of this chapter. ".repeat(10)}</p></body></html>`;

  it("reads the book's navigation into clickable contents", async () => {
    const f = await epub({
      "META-INF/container.xml": `<container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>`,
      "OEBPS/content.opf": `<package xmlns:dc="http://purl.org/dc/elements/1.1/"><metadata><dc:title>A Book</dc:title></metadata><manifest>
        <item id="nav" href="nav.xhtml" properties="nav" media-type="application/xhtml+xml"/>
        <item id="c1" href="text/one.xhtml" media-type="application/xhtml+xml"/>
        <item id="c2" href="text/two.xhtml" media-type="application/xhtml+xml"/></manifest>
        <spine><itemref idref="c1"/><itemref idref="c2"/></spine></package>`,
      "OEBPS/nav.xhtml": `<html><body><nav epub:type="toc"><ol><li><a href="text/one.xhtml">One</a></li><li><a href="text/two.xhtml#start">Two</a><ol><li><a href="text/two.xhtml#s">Two, part B</a></li></ol></li></ol></nav></body></html>`,
      "OEBPS/text/one.xhtml": chapter("One"),
      "OEBPS/text/two.xhtml": chapter("Two"),
    });
    const d = await ingestFile(f);
    expect(d.title).toBe("A Book");
    expect(d.toc?.map((t) => [t.title, t.level])).toEqual([["One", 1], ["Two", 1], ["Two, part B", 2]]);
    const at = (id: string) => d.blocks.find((x) => x.id === id)!.text;
    expect(at(d.toc![0].blockId)).toBe("One");
    expect(at(d.toc![1].blockId)).toBe("Two");
  });
});
