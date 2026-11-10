---
title: "Build log 02 — From reading tool to essay workspace"
project: Reading Desk
date: 2026-11-10
tags: [product design, writing tools, react, typescript, search, ux]
---

# From reading tool to essay workspace

Reading Desk began as a place to follow curiosity. This round, I pointed it at a real job: writing an essay.

**The essay:** *"The case for the trivial."* Handing more of life to agents and automation may let our physical, practical skills waste away: painting a wall, fixing a machine, the small competences that show us how the world actually works.

To write it, I needed to collect a research paper, article excerpts, definitions and blog posts. All of it had to connect back to that one statement, and I needed to write *while* reading, not after.

## What was missing

I walked through the essay in the app and listed every point where I had to stop:

1. **I couldn't just add a source.** Every branch had to grow from a highlighted passage. Sometimes a paper simply belongs to the essay.
2. **Everything looked the same.** A definition I looked up out of curiosity sat next to evidence I'd cite. Learning detours and essay material need to be told apart.
3. **There was no place to write that knew about my sources.** I wanted to write, and have the writing point back to exactly where each idea came from.
4. **There was no way to review.** My notes and highlights were scattered across cards.
5. **Searching meant leaving.** Finding a paper meant opening a Google tab.

## What I built

**Add, straight to the seed.** A new **Add** button takes a PDF, an EPUB, a web address, pasted text, a note or a dictionary look-up. No passage is needed. The new branch waits unlinked in the seed's margin until I drag its thread onto a sentence.

**Search inside the app.** **Add** opens on a **Search** tab with two sources:
- **Papers**, via OpenAlex: authors, year, journal, citation count, and whether a free copy exists.
- **Wikipedia.**

One click adds a result to the seed. Neither needs an API key.

**Essay or rabbit hole.** Every branch belongs to one of two tracks, set by a plain rule:
- Definitions, Wikipedia cards and Claude explanations, and anything that grows from them, are *rabbit holes*.
- Everything else is *essay* material.
- One click on a card's label switches it.

The Map can show just one track, and **Sort with Claude** suggests a track for each branch. It only *suggests*; nothing changes until I press Apply.

**Writing, linked to sources.** The old "Understanding" drawer became **Writing**, always one click away and never required.
- Select a passage and press **Cite**, and a link to that exact paragraph goes into my writing.
- Select words in an article and press **Add to writing**, and they arrive as a quotation with a link back to where I found them.
- Every link opens its source at the right place.

**A Notebook view.** A third mode next to Read and Map: one calm page holding my writing, notes, summaries and highlights. It's grouped by Essay / Rabbit hole or by source, and every quote jumps back to its passage.

**Reading beside writing.** An added article opens in **its own column** beside the page, as tall as the window and following me as I scroll. My notes sit on one side and the source on the other. Read view also gained real **zoom**, by buttons or trackpad pinch, so I can pull back and see the page, both margins and the article together.

## Getting it wrong first

Two first attempts didn't survive real use:

- **Zoom v1 scaled the text, not the page.** Zooming in made the font enormous, and zooming out shrank the page into a strip. What I wanted was a camera: the whole page moving as one. I rebuilt it with CSS `zoom` on the page and its margins together, and converted every pointer and layout measurement back into page units. That way selections, threads and resizing still land exactly.
- **The article first opened as a floating panel**, then inside a cramped margin card. Neither felt like *reading*. A dedicated column was what my screenshots had been asking for all along.

## Bugs worth remembering

- **A card that vanished while I typed.** Linked cards are placed beside their passage's marks. In typing mode the marks aren't drawn, so the card lost its position. It now keeps its last place.
- **A crash hidden in plain sight.** The layout code measured the left margin even when a narrow window had hidden it. It only surfaced once a reader panel made the page narrower.
- **A focus race.** Switching tabs in the Add dialog moved the cursor 30 ms later, so fast typing could land in the wrong field. A flaky test exposed it, and a user would have hit it too. I fixed the dialog, not the test.
- **A flaky test that was really a timing assumption.** The swipe test measured the card's position mid-slide. It now waits for the slide to settle.

## Principles I kept

- **Claude only runs when asked.** Sorting, explaining and drafting are all buttons. Definitions and search use Wiktionary, Wikipedia and OpenAlex, not AI.
- **Sources stay in their own words.** Articles are never summarised or rewritten; my writing is mine, linked to theirs.
- **The page stays the centre.** Every new tool is one click away, and none of them is ever required.

**Stack:** React 18, TypeScript (strict), Vite, Zustand + IndexedDB, Express (local API), OpenAlex, Wikipedia and Wiktionary APIs, the Anthropic API (on request only), Vitest and Playwright.

**Result:**
- **Tests:** 109 unit tests and 49 browser tests, all passing three runs in a row, with new tests for each feature.
- **Size:** about 2,200 lines changed across 37 files.
