# Open-source libraries: what we use, what to add, and how

Reading Desk should feel calm and exact, like a good research tool, not a demo. That shapes which libraries earn a place: each one has to make reading clearer or saving safer. All of these are free and open source; licences are noted.

## Already in the app

| Job | Library | Licence | Why this one |
|---|---|---|---|
| The map | **React Flow** (`@xyflow/react`) | MIT | Pan, zoom, minimap, keyboard access and custom React nodes out of the box. Keep its small attribution on the map (the licence allows hiding it, but leaving it is good manners for a free tool). |
| Map layout | **d3-hierarchy** | ISC | Tidy-tree layout (Reingold–Tilford): parents centred over children, no overlaps, left to right. Fast enough for thousands of nodes. |
| Clean article text | **Mozilla Readability** + **jsdom** (server) | Apache-2.0 / MIT | The engine behind Firefox Reader View. Pulls the article out of a page without rewriting a word, and keeps the links so they can become branches. |
| PDFs | **pdf.js** (`pdfjs-dist`) | Apache-2.0 | Mozilla's PDF engine. Extracts the text layer page by page, and draws the original pages (Text / Original switch) with the words placed invisibly over them. |
| Words in page images | **Tesseract.js** + `@tesseract.js-data/eng` | Apache-2.0 | Reads pages that have no text layer (scans, text drawn as shapes) on the device. The engine and English model are copied into `public/ocr` on install, so nothing is fetched from a CDN. Recognised text carries a warning. |
| EPUB | **JSZip** | MIT | An EPUB is a zip of XHTML chapters; we read them in spine order. |
| Word | **mammoth** | BSD-2 | Turns .docx into clean HTML. |
| Saving | **Zustand** + **idb-keyval** | MIT / Apache-2.0 | Small store; IndexedDB holds far more than localStorage and survives restarts. |
| Icons | **lucide-react** | ISC | Consistent 1.5px line icons that sit well next to serif text. |
| Tests | **Vitest**, **Playwright** | MIT / Apache-2.0 | Unit tests for logic; real-browser tests for the flows. |

## Should the map be 3D?

**Not as the main view.** Short answer for why:

- A tree is hierarchical. A 2D tidy tree shows that hierarchy instantly (left = earlier, right = deeper). In 3D, branches hide behind each other and you have to orbit to read labels.
- Labels are the content. Text in 3D is blurry at angles, hard to click, and fails accessibility (screen readers, keyboard, reduced motion).
- It costs a lot: three.js adds roughly 600 KB, drains phone batteries and needs WebGL fallbacks.

**Where 3D is worth it:** a later, optional **"Galaxy" view across all your trees**, where you're looking for clusters and surprising connections between topics rather than reading. That's exploration, not navigation, so the trade-offs flip.

If you build it:

| Library | Licence | Use |
|---|---|---|
| **react-force-graph** (`react-force-graph-3d`, also has `-2d`) | MIT | Fastest route. Give it `{ nodes, links }` and it renders a force-directed 3D graph with three.js. |
| **three.js** + **@react-three/fiber** + **@react-three/drei** | MIT | Full control if you want custom visuals later. More work. |
| **d3-force-3d** | MIT | The physics behind react-force-graph, if you want your own renderer. |

How to add the Galaxy view (about a day's work):

1. `npm install react-force-graph-3d`
2. Create `src/components/galaxy/GalaxyView.tsx`. Lazy-load it so it never slows the rest of the app: `const GalaxyView = lazy(() => import("./components/galaxy/GalaxyView"))`.
3. Build the graph data from the store: one node per tree and per topic; links tree → topic and topic → parent topic. Colour nodes with the CSS tokens (read them with `getComputedStyle(document.documentElement)`).
4. On node click, `navigate("/tree/" + id)`. Keep labels as HTML overlays (`nodeLabel`) so they stay crisp.
5. Respect `prefers-reduced-motion`: set `cooldownTicks={0}` and disable auto-rotate.
6. Add a route `/galaxy` and a sidebar link. Add one Playwright test that the canvas renders and clicking a tree node navigates.

A 2D alternative for the same view: `react-force-graph-2d` or **Sigma.js** (MIT, WebGL 2D, great for big graphs). Try 2D first; it's usually clearer.

## What to add next, in order

| When | Job | Library | Licence | Notes |
|---|---|---|---|---|
| Next | **Accounts and sync** between laptop and phone | **Supabase** (`@supabase/supabase-js`) | Apache-2.0 / MIT | Postgres + auth + file storage. Tables mirror the store: `trees`, `nodes`, `docs`, `topics`, `highlights`. Keep IndexedDB as the offline cache and sync on change. Row-level security so only you can read your rows. |
| Alternative | Sync without a server you manage | **Yjs** + `y-indexeddb` (+ `y-websocket` or Liveblocks) | MIT | Conflict-free merging if you edit on two devices offline. More moving parts; choose this if offline-first matters more than simplicity. |
| Soon | **Rich notes and understanding** (headings, bold, links, quotes) | **TipTap** (on ProseMirror) | MIT | Store as JSON; render read-only marks the same way. Add `[[` to link to another branch. |
| Soon | **Phone install, offline** | `vite-plugin-pwa` (Workbox) | MIT | Adds a manifest and service worker so it installs like an app on iPhone and Android. |
| Soon | **Fast search** across everything | **MiniSearch** or **FlexSearch** | MIT / Apache-2.0 | Fuzzy full-text search for the command palette over all node text. |
| Later | **Clip from any site in one click** | A small browser extension (WebExtension API) | — | Sends the selection, its URL and title to Reading Desk as a branch. This is the honest replacement for an embedded Google pane, which browsers block. |
| Later | **Better map layout** for very wide trees | **elkjs** | EPL-2.0 | Layered layouts with edge routing. Only if d3-hierarchy starts to feel cramped. |
| Later | **Animations** between card and map | **Motion** (`motion`, formerly Framer Motion) | MIT | Shared-element transition: the card shrinks into its map node. Keep it under 300 ms. |

## Rules for adding any library

1. **Check the licence** is MIT, Apache-2.0, BSD or ISC for anything shipped to the browser.
2. **Check the size** on bundlephobia.com. Anything over ~50 KB gzipped gets lazy-loaded (`React.lazy` + dynamic `import()`).
3. **Check it's maintained** (commits in the last 6 months, open issues answered).
4. **Wrap it** in one file (`src/lib/…` or one component), so it can be swapped later without touching the rest.
5. **Theme it with tokens**, never its default colours, so light and dark mode stay consistent.
6. **Add a test** for the behaviour it enables.

## A prompt to add one of these with an AI assistant

> Read CLAUDE.md and docs/LIBRARIES.md. Add [library] to do [job], following "Rules for adding any library": wrap it in one file, lazy-load it if it's large, theme it with tokens from src/styles/tokens.css, and add a unit or Playwright test. Don't change unrelated files. Finish by running typecheck, build, npm test and npm run test:e2e, and tell me what changed.
