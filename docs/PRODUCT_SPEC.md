# Reading Desk: product spec (v0.2)

## In one line
Grow a tree of understanding from anything you read. Branch from any sentence into another source, a definition, an explanation or your own note; slide between them as cards; zoom out to see the whole map.

## Who it's for
A curious person following an idea down a rabbit hole: payments, a philosophical term from a book, a company before a job interview, a news story. They want to go deep without losing sight of the piece that started it, and without juggling browser tabs.

## Feel
Consumer-grade and calm, with a research quality. Apple-level polish: few visible controls, generous whitespace, serif reading text, tools that appear only when you select something. Claude never appears unless asked.

## Core concepts
| Concept | What it is |
|---|---|
| **Tree** | Everything that grew from one starting point. Has a title, topics, an understanding note, and saved trails. |
| **Seed** | The starting point of a tree: a PDF, EPUB, article, pasted text, web page, or an idea you write yourself. |
| **Branch** | Anything that grew from a sentence: another **source**, a **note**, a **definition**, a Claude **explanation**, or a **clipping** pasted from elsewhere. Every branch remembers the exact passage it came from (its anchor). Branches can have branches. |
| **Card** | A branch opened for reading. Cards stack left to right; earlier cards fold into slim spines you can click or slide back to. |
| **Trail** | The chain of cards you have open (e.g. Stripe → How card payments work → PCI DSS → 3D Secure). Trails are saved automatically and can be resumed. |
| **Map** | The zoomed-out view of a tree: every branch as a node, joined by the passages that led to it. |
| **Topic** | A label you give trees. Topics can sit under several bigger topics: *Syllogistic method* → *Logic* → both *Philosophy* and *Computer Science*. |
| **Understanding** | A living note per tree: what you understood, in your words. Claude can draft one only when asked. |
| **Highlight** | A mark on a passage with nothing attached. |

## Screens
### Trees (home, `/`)
Your trees as cards: a small silhouette of each tree's shape, the seed's title, topics, branch and source counts, last opened, and Resume. "New tree" starts from a file, pasted text, a web address, or an idea you write.

### Tree (`/tree/:id`)
- **Header:** tree title (editable), topic chips (add, remove, create), Cards | Map switch, Trails (resume a previous chain), Understanding, Ask Claude.
- **Cards view:** the trail as sliding cards. Each card is a reading surface with a margin rail on its right showing that card's branches, level with their passages and joined by thin curved threads.
  - Opening a branch adds it as the next card and closes any cards after the one you branched from.
  - Earlier cards collapse to spines showing their titles; click a spine or slide back to return.
  - On a phone each card is full width; swipe between cards, and branches open in a bottom sheet.
- **Map view:** the whole tree, laid out left to right from the seed. Each node shows its kind, title and a snippet; edges show the passage that led there. Pan, zoom, fit, minimap. Clicking a node opens the trail from the seed to it in Cards view. The current trail is highlighted.
- Opening a tree starts at the seed, with a "Resume" pill for the last trail.

### Topics (`/topics`)
An outline of topics. A topic with several parents appears under each, marked "also under …". Select a topic to rename it, change its parents (cycles are prevented), see its subtopics and the trees filed under it or its subtopics.

## Branching from a selection
Selecting text shows a frosted toolbar:
| Action | Result |
|---|---|
| Highlight (H) | Marks the passage |
| Note (N) | A note branch in the margin, cursor ready |
| Define (D) | A definition branch from Wikipedia/Wiktionary. If none is found, you write your own or ask Claude |
| Branch… (B) | Opens a source from a file, pasted text or a web address, or starts a longer note; it opens as the next card |
| Explain ✦ (E) | Claude explains the passage, at Educational, Technical or Both depth |
| Ask ✦ (A) | Opens Ask Claude with the passage quoted |
✦ marks the only actions that call Claude.

Other ways to branch:
- **Pull a thread:** drag the dot at the end of a selection into the margin (note), onto a branch card (link it there too), or onto another sentence (one note linking both).
- **Paste:** select a passage or click the margin, then ⌘V. Pasted text becomes a clipping with its source when the browser provides it; otherwise the card asks for one.

## Saving
Everything saves automatically on the device (IndexedDB). Trails are recorded as you open cards. Export and Import (JSON) make a full backup. Accounts and sync across laptop and phone come next (see roadmap).

## Accuracy
PDFs, EPUBs and pasted text are shown exactly as extracted. Web pages are reduced to their readable text with Mozilla's Readability; every web card keeps a link to the original, and pages where text may be missing (very short extractions) are flagged.

## Claude
Only on request: Explain, Ask, Draft understanding. Answers are grounded in the cards on the current trail and cite (p. N). Explanations are labelled as Claude's.
