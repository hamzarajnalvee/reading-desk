# Reading Desk

A place for rabbit holes. Start a tree from one seed (a PDF, an EPUB, an article, a web page, or just an idea you write down), and every time something makes you curious, grow a branch from the exact sentence that sparked it. Branches open as cards you slide between, so you never leave the page or lose your place. Zoom out and the whole tree is a map.

Claude only joins in when you ask.

> **Work in progress.** Reading Desk is being built in the open and changes often. Suggestions, ideas and bug reports are very welcome: [open an issue](https://github.com/hamzarajnalvee/reading-desk/issues) or start a discussion.

## Run it

You need Node.js 20 or newer.

```bash
npm install
cp .env.example .env      # optional: add ANTHROPIC_API_KEY for real Explain and Ask answers
npm run dev               # web app on http://localhost:5173, API on http://localhost:8787
```

Without an API key the app runs in **demo mode**: everything works, and Explain and Ask return clearly labelled sample answers. Definitions come from Wiktionary and Wikipedia and don't need a key.

| Command | What it does |
|---|---|
| `npm run dev` | Web app and API together |
| `npm run build` | Typecheck and production build to `dist/` |
| `npm run typecheck` | TypeScript only |
| `npm test` | Unit tests (Vitest), 59 tests |
| `npm run test:e2e` | Browser tests (Playwright), 21 flows. First time: `npx playwright install chromium`. If that download stalls, point at your own Chrome: `PW_CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run test:e2e` |

## The ideas

| Word | Meaning |
|---|---|
| **Tree** | One rabbit hole. It has a seed, branches, topics, an understanding note and its trails. |
| **Seed** | What started it: a document, a page, or an idea you wrote. |
| **Branch** | Anything that grew from a sentence: another source, a note, a definition, an explanation, a clipping. Each remembers the passage it came from. |
| **Card** | How a branch opens. Earlier cards fold to the left as spines. |
| **Trail** | The chain of cards you had open. Opening a tree starts at the seed; **Resume** reloads your last trail. |
| **Map** | The whole tree, zoomed out. Click any node to open its trail. |
| **Topic** | A name tag. Topics can sit under several bigger topics (Syllogistic method → Logic → Philosophy *and* Computer Science). |
| **Understanding** | Your living summary of the tree. Add to it and change it whenever you like. |

## How to use it

- **Select text** for the toolbar: Highlight, Note, Define, Branch, Explain, Ask. Shortcuts while text is selected: H N D B E A. Explain and Ask (marked ✦) are the only actions that call Claude.
- **Write in place:** click anywhere in your own writing (an idea or a note opened as a card) and type. It saves as you type; press Esc or click outside the text to highlight and branch again. Sources keep the original's words and can't be edited.
- **Lock or delete a tree:** use the ⋯ menu in the tree's header. A locked tree can be read, mapped and asked about, but nothing in it can be changed or deleted until you unlock it.
- **Pull a thread:** after selecting, drag the green dot into the margin to write a linked note.
- **Branch:** add another source from a web address, a file, pasted text, or your own writing. It opens as the next card.
- **Links in pages** you've opened can be followed in place: they become branches instead of browser tabs.
- **Paste from anywhere:** click the margin and press ⌘V. It becomes a clipping with its source.
- **Slide between cards:** click a spine, or press `[` and `]`. On a phone, swipe; branches open in a sheet.
- **Save:** everything saves on this device as you go (IndexedDB). Use the ⋯ menu in the sidebar to export a backup file and import it on another device until sync arrives.

## What's in it

| Screen | Route |
|---|---|
| Your trees | `/` |
| A tree (cards or map) | `/tree/:treeId?path=a,b,c&view=map` |
| Topics | `/topics` |
| Component gallery | `/components` |
| Command palette | `⌘K` anywhere |

## Project structure

```
server/                Express API: holds the Anthropic key, fetches pages (Readability), definitions
src/
  app/                 Routes and the app shell
  components/          Sidebar, command palette, coach marks, shared UI
  components/reader/   The reading sheet, selection toolbar, threads
  components/tree/     Card stack, reading card, branch card, map, dialogs, drawers, topics, trails
  screens/             Home, Tree, Topics, Components
  store/               Zustand store, persisted to IndexedDB
  data/                Types and the sample trees (Payments, Telos)
  lib/                 Anchors, content, layout, actions, API client, ingestion, clipboard, backup
  styles/              Design tokens and CSS by area
tests/e2e/             Browser tests (Playwright)
docs/                  Product spec, design system, libraries, AI build guide, roadmap
.github/workflows/     CI: typecheck, build, unit tests, browser tests
```

## Docs

- [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md): what the product is and how every feature behaves
- [docs/LIBRARIES.md](docs/LIBRARIES.md): the open-source libraries used, what to add next (including 3D), and how
- [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md): tokens, type, components, motion
- [docs/AI_BUILD_GUIDE.md](docs/AI_BUILD_GUIDE.md): how to keep building with Claude or ChatGPT, with ready-to-paste prompts
- [docs/ROADMAP.md](docs/ROADMAP.md): what's done and what's next
- [CLAUDE.md](CLAUDE.md) / [AGENTS.md](AGENTS.md): rules for AI coding assistants working in this repo

The map uses [React Flow](https://reactflow.dev) (MIT); its attribution is kept on the map.

## History

Built over a few sessions in November 2026:

| Date | What changed |
|---|---|
| 1 Nov | Scaffold: Vite + React + TypeScript, base styles, text anchoring, clipboard parsing, storage, unit tests, CI |
| 4 Nov (morning) | v0.2: trees, sliding cards, map (React Flow + d3-hierarchy), page extraction with Readability, Claude-on-request prompts, topics, backups, command palette, docs |
| 4 Nov (afternoon) | Accounts and sync with Supabase, sign-in screen, server auth |
| 5 Nov (13:21) | Sync merge fixes and a second migration |
| 5 Nov (14:00) | Lock and delete trees from the tree menu, store tests |
| 5 Nov (16:30) | Write in place: edit your own ideas and notes directly in the card |
