// Core data model. See docs/PRODUCT_SPEC.md.

export type DocType = "paper" | "report" | "book" | "article" | "web";
export type DocFormat = "pdf" | "docx" | "epub" | "html" | "md" | "txt" | "paste" | "web";

/** One paragraph or heading. Anchors point into blocks by character offsets. */
export interface Block {
  id: string;
  kind: "h" | "p";
  text: string;
  page: number;
  label?: string;
  /** Hyperlinks inside the block (character ranges), which can be followed as branches. */
  links?: { start: number; end: number; href: string }[];
  /** A quotation you added to your writing; `attrib` is where its italic source line starts in `text`. */
  quote?: boolean;
  attrib?: number;
}

/** A line of text recognised on a page image. x, y, w, h are fractions of the page's width and height (y from the top). */
export interface OcrLine { t: string; x: number; y: number; w: number; h: number }

/** One entry in a source's table of contents, pointing at the block where that part begins. */
export interface TocEntry {
  title: string;
  blockId: string;
  /** 1 for chapters, 2 for sections inside them, and so on. */
  level: number;
}

/** The text of a source (PDF, EPUB, web page…). Owned by one source node. */
export interface Doc {
  id: string;
  title: string;
  authors?: string;
  year?: number;
  type: DocType;
  format: DocFormat;
  pages: number;
  blocks: Block[];
  addedAt: number;
  url?: string;
  site?: string;
  /** Set when extraction may have dropped content (e.g. a very short web page). */
  warning?: string;
  /** The original file (a PDF) is kept, so its real pages can be shown with figures, tables and layout. */
  hasOriginal?: boolean;
  /** Pages whose words were recognised from the page image (no text layer): each line, with its box as fractions of the page. */
  ocr?: Record<number, OcrLine[]>;
  /** The source's own table of contents (PDF outline, EPUB navigation), when it has one. */
  toc?: TocEntry[];
  lastOpenedAt?: number;
}

/** Readable content of any card: a source's Doc, or a note's body split into blocks. */
export interface Content {
  id: string;
  title: string;
  blocks: Block[];
}

/** An exact span of text inside a card. `docId` is the id of the node whose content it points into. */
export interface Anchor {
  docId: string;
  blockId: string;
  start: number;
  end: number;
  quote: string;
  page: number;
}

export interface Source {
  url?: string;
  site?: string;
  title?: string;
}

export type NodeKind = "source" | "note" | "definition" | "explanation" | "clipping";
export type Depth = "educational" | "technical" | "both";
/** What a branch is for: material for the essay you're writing, or a rabbit hole you followed to learn. */
export type Track = "essay" | "rabbit";

/** Anything in a tree: the seed, or a branch that grew from a passage in its parent. */
export interface TreeNode {
  id: string;
  treeId: string;
  kind: NodeKind;
  title: string;
  /** null for the seed. */
  parentId: string | null;
  /** Passages in the parent this branch grew from. The first is where it sits in the margin; more are extra threads. */
  anchors: Anchor[];
  /** Sources: the Doc holding their text. */
  docId?: string;
  /** Notes, definitions, explanations: Markdown body. */
  body?: string;
  /** Clippings: the pasted text and where it came from. */
  clip?: { text: string; source: Source };
  /** Definitions: where the definition came from (e.g. Wikipedia), or none if you wrote it. */
  defSource?: Source;
  /** Explanations: the depth Claude was asked for. */
  depth?: Depth;
  /** Unattached clippings sit at this vertical position in the margin. */
  marginY?: number;
  /** Sources opened from a web address keep it, so they can be retried or opened in the browser. */
  url?: string;
  /** Which margin the branch sits in, beside the page. Unset means the right. */
  side?: "left" | "right";
  /** Where you dragged the card: `away` px further from the page (sideways), `dy` px up or down from its passage. */
  nudge?: { away: number; dy: number };
  /** A size you gave the branch's card by dragging its corner. */
  size?: { w: number; h: number };
  /** Explanations: a question you asked Claude about the passage (empty while you're still typing it). */
  question?: string;
  /** Notes: a summary of the section (or whole source) it's anchored to. Listed with the source's contents. */
  summary?: boolean;
  /** Essay or rabbit hole, when you (or a suggestion you accepted) set it. Unset means the rule in lib/tracks.ts decides. */
  track?: Track;
  /** Transient states, never persisted. */
  pending?: boolean;
  error?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface Highlight {
  id: string;
  /** The card (node) whose text is highlighted. */
  nodeId: string;
  anchor: Anchor;
  createdAt: number;
}

/** A chain of open cards, seed first. */
export interface Trail {
  id: string;
  nodeIds: string[];
  openedAt: number;
}

export interface Tree {
  id: string;
  title: string;
  seedId: string;
  topicIds: string[];
  understanding: string;
  trails: Trail[];
  createdAt: number;
  updatedAt: number;
  lastOpenedAt?: number;
  /** Read-only: nothing in the tree can be changed or deleted until it's unlocked. */
  locked?: boolean;
}

/** Topics form a web, not a single hierarchy: a topic may sit under several parents. */
export interface Topic {
  id: string;
  name: string;
  parentIds: string[];
  createdAt: number;
}

export interface ChatTurn {
  id: string;
  role: "user" | "assistant";
  text: string;
  quote?: Anchor;
  error?: string;
  createdAt: number;
}
