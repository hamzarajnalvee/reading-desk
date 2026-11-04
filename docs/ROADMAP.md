# Roadmap

## Step 1: built and working (v0.2)
- **Trees** from any seed: an idea you write, a web address, a file (PDF, EPUB, Word, HTML, Markdown, text) or pasted text
- **Branches** tied to the exact sentence that sparked them: another source, a note, a definition, an explanation, a clipping; highlights
- **Sliding cards**: each branch opens as the next card; earlier cards fold to spines; `[` and `]` to move; closing goes back; opening from an earlier card replaces what came after
- **Following links in place**: links inside fetched pages open as branches, not browser tabs
- **Pages as faithful text** (Mozilla Readability on the server), with a warning and "Open in browser" when a page can't be fetched or looks incomplete
- **Map**: the whole tree as a tidy left-to-right tree (React Flow + d3-hierarchy); click any node to open its trail
- **Trails**: opening a tree starts at the seed; Resume reloads the last trail; recent trails in the Trails menu
- **Topics** that can sit under several bigger topics, with cycle protection
- **Understanding note** per tree, saved as you type, with "Draft with Claude" on request
- **Claude only on request**: Explain (Educational / Technical / Both) and Ask; definitions come from Wiktionary and Wikipedia
- **Saving** on this device (IndexedDB), plus backup export and import
- Phone layout: full-width cards with swipe, branches in a bottom sheet
- Light and dark themes, command palette, first-run tips
- Tests: 59 unit tests, 21 browser tests, CI on every push

## Known limits
- **Sync**: saving is per browser. Moving between laptop and phone needs export/import until accounts land.
- **PDF links**: links inside PDFs aren't followable yet (pages and EPUBs are).
- **Original PDF pages**: cards show the extracted text, not the page image with figures.
- **Pages behind a login or built only with JavaScript** can't be fetched; paste the text or upload a saved PDF instead.
- **Selections across paragraphs** are clamped to the first paragraph.
- **Notes are plain text** (light Markdown: bold, italics, links).

## Next steps
Ready-to-paste prompts for each are in `docs/AI_BUILD_GUIDE.md`; library choices are in `docs/LIBRARIES.md`.
1. **Accounts and sync** (Supabase) so laptop and phone share trees
2. **Install on your phone** (PWA) and offline
3. **PDF links and original pages** (react-pdf), so PDF citations become branches too
4. **Rich notes and understanding** (TipTap) with `[[` links between branches
5. **Clip from anywhere**: a browser extension that sends a selection and its source into the open tree
6. **Search everything** (MiniSearch) from the command palette
7. **Galaxy view** across all trees (optional 3D with react-force-graph)
8. **Export** a tree as Markdown (Obsidian-friendly) or a PDF reading report
