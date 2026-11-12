# Working on Reading Desk (instructions for AI coding assistants)

Read this before changing code. Also read `docs/PRODUCT_SPEC.md` for behaviour, `docs/DESIGN_SYSTEM.md` for visuals and `docs/LIBRARIES.md` before adding a dependency.

## The model in one paragraph
A **tree** grows from one **seed**. Every **branch** (`TreeNode`: source, note, definition, explanation, clipping) has a `parentId` and is anchored to the passage that sparked it. Branches open as **cards** in a horizontal stack; the open chain is the **trail** (`?path=a,b,c` in the URL). The **map** draws the same nodes as a tidy tree. **Topics** form a graph (a topic may have several parents; no cycles). Each tree has an **understanding** note. Types are in `src/data/types.ts`.

## Stack
- React 18 + TypeScript (strict) + Vite. Routing with react-router 6.
- State: one Zustand store in `src/store/useStore.ts`, persisted to IndexedDB via `idb-keyval`. Transient fields (`pending`, `error`, UI) are stripped in `partialize`.
- Styling: plain CSS with design tokens in `src/styles/tokens.css`. No Tailwind, no CSS-in-JS.
- Map: `@xyflow/react` (React Flow) + `d3-hierarchy` layout in `src/lib/layout.ts`. Keep React Flow's attribution.
- AI: `server/index.ts` (Express) calls the Anthropic API. The browser only calls `/api/*`. Never put an API key in `src/`.

## Rules
1. **Colours, radii, shadows and fonts come from tokens.** Never hard-code a hex value in a component or CSS rule; add a token with light and dark values.
2. **Annotations anchor by block id + character offsets + quote** (`Anchor`). Marks are rendered from data in `DocumentSheet.tsx`. Never mutate the document DOM by hand, and never insert text nodes inside a block (use CSS `::before`/`::after`), because offsets are measured on `textContent`.
3. **Zustand selectors must return stable values.** Don't write `useStore(s => s.items.filter(...))` or `s.x || []`; select the raw value and derive with `useMemo`, or use a module-level empty constant.
4. **Effects must not depend on arrays rebuilt every render** (e.g. `path`). Key them on a string (`path.join(",")`) or they will re-run and fight the user.
5. **Claude only runs when the user asks** (Explain, Ask, Draft understanding). Never call the API on load, on selection or in the background. Definitions come from Wiktionary/Wikipedia, not Claude.
6. **Text must be faithful.** Extracted pages and files are shown as the source's own words; never summarise or rewrite source text. If extraction looks incomplete, show a warning and a link to the original.
7. **One component per file**, named exports, props typed inline or with an interface next to the component.
8. **Copy is plain, active and specific.** Buttons say what they do. Errors say what went wrong and what to do.
9. **Keep the margin quiet.** Tools appear on selection or hover.
10. **Accessibility:** icon-only buttons get an `aria-label`; interactive things are real `<button>`/`<a>`; respect `prefers-reduced-motion`.
11. Run `npm run typecheck`, `npm run build`, `npm test` and `npm run test:e2e` before you finish. All must pass. Add or update tests for behaviour you change: unit tests next to the code (`*.test.ts`), browser tests in `tests/e2e/`.
12. Tests find elements by role, label or `data-testid`. Keep these when refactoring: `card` (+ `data-node`), `card-stack`, `margin`, `branch-card` (+ `data-kind`, `data-branch`), `selection-toolbar`, `thread-handle`, `tree-card`, `resume`, `tree-map`, `map-node` (+ `data-node`), `understanding`, `ask`, `topic-row`, `topic-detail`, `branches-toggle`, `contents`, `chapter-bar`, `branch-popup`, `reader`, `add-to-tree`, `track-chip`, `notebook`, `notebook-entry`, `cite`, `sort-suggestions`, `zoom`, `article`, `excerpt-cite`, `search-hit`, `page-grip`, `page-edge`, `link-end`, `link-menu`, `link-list`, `view-original`, `original`, `error-screen`.

## Where things live
- Tree screen (Read/Map toggle, trail bar, resume, drawers): `src/screens/TreeScreen.tsx`
- Card stack and sliding: `src/components/tree/CardStack.tsx`
- Notebook view (everything you wrote, by track or source): `NotebookView.tsx`; essay/rabbit-hole rules: `src/lib/tracks.ts`; passage links in your writing (`#cite:` links): `src/lib/writing.ts`
- Popups over the page: `BranchPopup.tsx` (Open on a branch), `ReaderPopup.tsx` (web links, Wikipedia); contents and summaries: `ContentsPanel.tsx`, `src/lib/contents.ts`
- One card (selection, threads, margin layout, paste/drop, link following): `src/components/tree/ReadingCard.tsx`
- Margin branch cards: `src/components/tree/BranchCard.tsx`
- Map: `src/components/tree/TreeMap.tsx`; layout: `src/lib/layout.ts`
- Branch actions (from URL, definition, explanation): `src/lib/actions.ts`
- Node content and tree walking: `src/lib/content.ts`
- Text anchoring: `src/lib/anchors.ts`; clipboard/drop parsing: `src/lib/clipboard.ts`; file ingestion: `src/lib/ingest.ts`
- PDFs as their original pages: `src/components/reader/OriginalPages.tsx` and `OriginalPage.tsx` (page image + invisible text placed on the blocks by `src/lib/pageText.ts`); original files: `src/lib/originals.ts` (IndexedDB + Supabase Storage bucket `originals`); words on pages with no text layer: `src/lib/ocr.ts` (Tesseract.js, served from `public/ocr`, copied by `scripts/copy-ocr-assets.mjs`)
- Page extraction (Readability): `server/extract.ts`; prompts: `server/prompts.ts`; endpoints: `server/index.ts`; client: `src/lib/api.ts`
- Backup export/import: `src/lib/backup.ts`
