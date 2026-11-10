---
title: "Build log 01 — Reading like a book, and killing the canvas"
project: Reading Desk
date: 2026-11-10
tags: [product design, react, typescript, reading, ux]
---

# Reading like a book, and killing the canvas

**Reading Desk** is a tool for following reading rabbit holes. You start a *tree* from a seed (a PDF, an EPUB, a web page or just an idea) and grow *branches* from passages: notes, definitions, Claude explanations, other sources. Each branch is anchored to the exact words that sparked it.

This log covers one round of work: making long sources (books especially) feel navigable, and a design detour I had to undo.

## The problem

I uploaded a book and hit three things at once:

- **The table of contents was unusable.** It came through as flat text: duplicated, unclickable, and impossible to navigate by.
- **The page was cluttered.** Branch cards sat permanently beside the text. The thing I was reading was competing with everything I'd made from it.
- **There was nowhere to summarise.** I wanted to write a summary of a chapter *at* that chapter, and find all my summaries in one place later.

## What I built

**Real contents, from the source itself.** PDFs carry an outline and EPUBs carry a navigation document. I read both: pdf.js outlines become *outline → page → block*, and EPUB nav/NCX entries map onto the spine. Every entry becomes a pointer to the paragraph where that part starts. Sources without one fall back to their headings, with duplicates removed. Titles on a book's printed contents page become clickable links too.

**A chapter bar.** A slim, sticky bar shows the part you're in, previous and next, and how far through you are. It also has one button: *Summarise this section*.

**Summaries that live in two places.** A summary is a note anchored to the section's heading. It sits beside the section, and it also appears under that entry in a *Contents & summaries* panel, so the contents double as an outline of what I've understood.

**A quiet page.** Branches are hidden by default behind one toggle. When they're shown, there are **two margins**: a branch goes to the side nearest its passage, can be moved across, and can be resized by its corner. Threads join each card to its words.

**Popups instead of new cards.** "Open" on a note used to push a whole new card onto the stack just to type in. Now it opens an editor over the page. Web links and Wikipedia articles open in a reader panel, and you keep one as a branch only if it's worth keeping.

## The detour: a zoomable canvas

My first answer to "I want to see everything at once" was a **zoomable canvas**: the page and its cards as movable windows on an infinite board.

It was the wrong call, and I could tell within minutes of using it:

- **Windows inside windows.** The page became just another box, smaller than before, and the cards were fiddly to move.
- **It broke the trackpad.** Hovering over the canvas captured sideways swipes, so I couldn't slide between cards. That's the most basic gesture in the app.
- **It duplicated something that already worked.** The *Map* view already shows the whole tree.

So I removed it and settled on **two modes**: **Read** for reading, branching, notes and asking, and **Map** for seeing the whole tree. The two-margin layout gave me what I'd actually wanted from the canvas, cards on both sides joined to their passages, without giving up the page.

**Lesson:** when a feature makes the core gesture worse, it isn't a feature. Shipping it, feeling it, and cutting it quickly beat defending it.

## Engineering notes

- **Anchors are data, not DOM.** Every annotation is `block id + character offsets + quote`, and marks are rendered from data. Never mutating the page by hand made the two-margin layout safe to build.
- **Container queries** decide how many margins fit (`@container card`), so the layout follows the card's width rather than the window's.
- **Tests caught real bugs:**
  - the sticky chapter bar hid elements scrolled into view (fixed with `scroll-padding-top`);
  - the selection toolbar wrapped and covered the thread handle;
  - "current part" tracking failed at the very end of a book.
- I ran the browser tests repeatedly to flush out flaky hover-dependent tests, and switched those to keyboard focus.

**Stack:** React 18, TypeScript (strict), Vite, Zustand persisted to IndexedDB, pdf.js, JSZip, React Flow for the map, Vitest and Playwright.

**Result:** 100 unit tests and 39 browser tests passing, and one fewer mode than I started with.
