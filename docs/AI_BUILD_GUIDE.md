# Building Reading Desk with Claude or ChatGPT

This repo is set up so an AI coding assistant can pick it up cold. `AGENTS.md` (also copied to `CLAUDE.md`) holds the rules; `docs/PRODUCT_SPEC.md`, `docs/DESIGN_SYSTEM.md` and `docs/LIBRARIES.md` hold the what, the how-it-looks and which libraries to use.

## 1. Choose how you'll work

| Tool | Setup | Notes |
|---|---|---|
| **Claude Code** (terminal, desktop or web) | Open the repo folder, or connect the GitHub repo | Reads `CLAUDE.md` automatically. Can run `npm run build` itself. Best option. |
| **ChatGPT Codex** | Connect the GitHub repo | Reads `AGENTS.md` automatically. Works on a branch and opens a PR. |
| **Claude or ChatGPT chat with a Project** | Create a Project and upload `AGENTS.md`, the three docs, and the files a task touches | No file access: ask for complete files back, then paste them in. Keep tasks small. |

Put the code in a GitHub repository first (`git init`, commit, push). Every phase below should end in its own commit so you can roll back.

## 2. How to run each session
1. Start with: *"Read AGENTS.md, docs/PRODUCT_SPEC.md and docs/DESIGN_SYSTEM.md. Then read the files you need for the task below. Before writing code, give me a short plan."*
2. Paste one phase prompt from section 3.
3. Approve or adjust the plan.
4. Require at the end: *"Run npm run typecheck, npm run build, npm test and npm run test:e2e and fix anything that fails. Add tests for what you built. List every file you changed."*
5. Try it yourself with `npm run dev`. Report what's wrong in plain words ("the second card jumps back when I scroll"), with a screenshot if you can.
6. Commit.

Tips:
- One phase per session. Long sessions drift.
- If the assistant suggests rewriting the store, the tree model, the anchoring model or the CSS approach, say no unless that's the task.
- For design changes, give the token or component name from `DESIGN_SYSTEM.md` ("use `--shadow-pop`", "add a variant to BranchCard").

## 3. Phase prompts (copy and paste)

Step 1 (trees, branches, sliding cards, map, topics, trails, understanding, saving, tests) is done. These are the next steps, in order.

### Phase 2: Accounts and sync (laptop + phone)
```
Add accounts and sync with Supabase, keeping Reading Desk local-first. Read docs/LIBRARIES.md first.
- Supabase Auth with email magic link. A small sign-in screen at /sign-in; the app still works signed out (local only).
- SQL migrations in /supabase for tables trees, nodes, docs, topics, highlights, each with user_id, updated_at and deleted (soft delete), and row-level security so users only read and write their own rows. Doc blocks can live as JSON in docs.
- A sync module in src/lib/sync.ts: push local changes and pull remote ones by updated_at (last write wins per record), on load, on window focus and every 60 s. Never sync pending/error fields.
- Sidebar footer shows "Synced just now", "Syncing…" or "Offline — saved on this device".
- Keep the Anthropic key on the server; require the user's Supabase session token on /api/explain and /api/ask when signed in.
Add unit tests for the merge logic. Follow CLAUDE.md.
```

### Phase 3: Install on a phone, offline
```
Make Reading Desk an installable PWA with vite-plugin-pwa: manifest (name, icons from the book logo, theme colours from tokens), a service worker that caches the app shell, and offline use of everything already saved. Show a quiet "You're offline: Explain, Ask and new web pages need a connection" toast when offline. Test on a 390px viewport: cards, the branches sheet and the understanding drawer must all work one-handed. Follow CLAUDE.md.
```

### Phase 4: PDF links and original pages
```
1) Follow links inside PDFs: when ingesting a PDF with pdf.js, read each page's link annotations (page.getAnnotations(), subtype "Link") and attach them to the blocks whose text they cover as block.links, the same shape pages already use, so they become followable branches.
2) Add a Text | Original toggle on PDF cards. Keep the original file as a Blob in IndexedDB (idb-keyval, key per doc, not in the store). Original view renders pages with react-pdf (canvas + text layer), lazily. Existing anchors highlight on the text layer by matching their quote on that page; new selections there create normal anchors.
Follow CLAUDE.md and docs/LIBRARIES.md.
```

### Phase 5: Rich notes and the understanding note
```
Replace the plain textareas for notes and the understanding note with TipTap (StarterKit + Link + Placeholder). Store TipTap JSON, keep a plain-text copy for search and the map label. Typing [[ opens a picker of branches in this tree and inserts a link that opens that branch's trail. Keep the margin quiet: no permanent toolbar; show formatting on selection only. Migrate existing plain-text bodies on load. Follow CLAUDE.md.
```

### Phase 6: Clip from anywhere
```
Build a Chrome extension (Manifest V3) in /extension: a context-menu item "Send to Reading Desk" on selected text that sends {text, url, title} to an open Reading Desk tab. The app adds it as a clipping branch on the active card (attached to the current selection if any). Include a README for loading it unpacked. Follow CLAUDE.md.
```

### Phase 7: Search everything
```
Index every tree title, node title, node body and doc block with MiniSearch (fuzzy, prefix). Use it in the command palette with snippets that highlight the match; choosing a result opens that node's trail and flashes the block. Rebuild the index incrementally on store changes. Follow CLAUDE.md.
```

### Phase 8: Galaxy view (optional 3D)
```
Follow the "Galaxy" steps in docs/LIBRARIES.md: a lazy-loaded /galaxy route with react-force-graph-3d showing trees and topics and the links between them, coloured with tokens, labels as HTML, click to open a tree, and reduced-motion respected. Add a 2D fallback when WebGL isn't available. Add one Playwright test. Follow CLAUDE.md.
```

### Phase 9: Export
```
Export a tree as Markdown (Obsidian-friendly: YAML front matter with topics, the understanding note first, then each branch as a section with its quoted passage, source link and children nested) and as a printable reading report (print stylesheet). Add both to the tree's ⋯ menu. Follow CLAUDE.md.
```

## 4. If you're using a chat without file access
Paste this first, then the phase prompt:

```
You are helping me build Reading Desk, a React + TypeScript + Vite app. I'll paste CLAUDE.md, the product spec, the design system, the libraries guide and the files relevant to the task. Return complete, updated files (not diffs), one code block per file with its path as the first line in a comment. Don't change files I haven't asked about. If you need to see another file, ask for it by path.
```
