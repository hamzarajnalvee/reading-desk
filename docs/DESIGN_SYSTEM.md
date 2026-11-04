# Reading Desk: design system

Extracted from the Reading Desk Figma file (Desktop Reader, Desktop Question, Tablet and Mobile frames) and extended for the screens Figma didn't cover. All values live in `src/styles/tokens.css`. The `/components` route renders every component from real code.

## Principles
1. **The page is the hero.** A crisp white sheet on a soft canvas; everything else recedes.
2. **Progressive disclosure.** Tools appear on selection or hover. The margin holds only cards.
3. **One accent.** Deep scholarly green, used for primary actions, selection and threads only.
4. **Colour encodes annotation type**, never decoration.
5. **Calm motion.** 160–260ms spring transitions. Cards slide and settle; threads draw as you drag.

## Colour (light / dark)
| Token | Light | Dark | Use |
|---|---|---|---|
| `--canvas` | #F5F5F7 | #1C1C1E | Behind the page |
| `--paper` | #FFFFFF | #2C2C2E | Document sheet |
| `--surface` | #FAF9F6 | #1C1C1E | Workspace screens |
| `--surface-raised` | #FFFFFF | #2C2C2E | Cards, popovers |
| `--sidebar` | rgba(232,232,225,.91) | rgba(36,36,38,.92) | Frosted sidebar |
| `--sidebar-active` | #E1E8D9 | accent 16% | Active nav item |
| `--ink` | #1D1D1F | #F5F5F7 | Text |
| `--ink-2` | #6E6E73 | #A1A1A6 | Secondary text |
| `--hairline` | #DCDDD5 | #3A3A3C | Dividers, card borders |
| `--accent` | #1F5E4C | #6CC1A2 | Primary actions, threads |
| `--link` | #1F55A3 | #8DB8F0 | URL links |
| `--a-highlight` | #F8F0C7 | gold 26% | Highlights |
| `--a-note` | #E6F0EA | accent 18% | Notes |
| `--a-claude` | #E8EDF2 | blue 16% | Claude explanations |
| `--a-clipping` | #F2EFE8 | white 7% | Web clippings |

## Type
| Role | Face | Size |
|---|---|---|
| UI | SF Pro (system), fallback Inter | 14px base; 12.5px small; 11px labels |
| Reading, titles, questions, clippings | Newsreader (fallback New York, Georgia) | 18px reading at 1.6 leading; titles 34–40px |
| Labels, page numbers | SF Mono, fallback JetBrains Mono | 10–11px, uppercase, 0.08em tracking |

Reading measure: about 68 characters (sheet max width 760px).

## Shape, depth, materials
- Radii: 6 (small), 10 (controls), 12 (cards), 14 (panels, popovers), pill.
- Shadows: `--shadow-sheet` for the page and hovered cards; `--shadow-pop` for popovers and palettes.
- Frosted material (`backdrop-filter: saturate(180%) blur(20px)`) on the sidebar, selection toolbar, popover, palette and toast.

## Components
| Component | File | Variants |
|---|---|---|
| Button | `components/ui.tsx` | primary, secondary, ghost, danger; md, sm |
| Segmented control | `components/ui.tsx` | Cards / Map, Educational / Technical / Both |
| Tree card (home) | `screens/HomeScreen.tsx` | with silhouette of the tree, branch count, Resume link |
| Reading card | `components/tree/ReadingCard.tsx` | active, folded to a spine; loading, failed page; note body editable |
| Branch card (margin) | `components/tree/BranchCard.tsx` | source, note, definition, explanation, clipping; pending; editing; delete confirm with sub-branch count |
| Thread line + handle | `components/reader/ThreadLayer.tsx` | rest, hot, dragging |
| Selection toolbar | `components/reader/SelectionToolbar.tsx` | Highlight, Note, Define, Explain, Branch, Ask |
| Add dialog | `components/tree/AddDialog.tsx` | new tree or branch; Write, Web address, File, Paste text |
| Map node | `components/tree/TreeMap.tsx` | by kind; on current trail; seed |
| Drawers | `components/tree/Drawers.tsx` | Understanding note, Ask Claude |
| Topic chips | `components/tree/TopicChips.tsx` | chip, add-topic input |
| Trails menu | `components/tree/TrailsMenu.tsx` | recent trails with Resume |
| Command palette | `components/CommandPalette.tsx` | trees, branches, topics, actions |
| Coach mark | `components/CoachMarks.tsx` | 4 steps; hidden while a dialog is open |

## Branch colours
Each branch kind has one token pair (fill + ink) used for its mark in the text, its margin card edge and its map node, so the same colour means the same thing everywhere: source (green), note (sand), definition (blue), explanation (violet, labelled "Claude"), clipping (grey), highlight (yellow wash).

## Motion
- `--spring: cubic-bezier(.32,.72,0,1)`; `--t-fast: 160ms`; `--t-med: 260ms`.
- Popovers rise 4px and fade in; panels slide 24px; cards animate their `top` when the margin re-flows.
- All motion is disabled under `prefers-reduced-motion`.

## Cards
- Earlier cards fold to 44px spines pinned on the left (`position: sticky`); each card's width is `calc(100cqw - (n-1) × 44px)` so the active card always fits whole.
- Opening a branch slides the stack; closing a card never moves you away from the one you're reading.

## Responsive
- Cards adapt to their own width (container queries), so opening a drawer narrows the margin rather than crushing the page.
- ≤ 1024px: the sidebar becomes an overlay.
- ≤ 760px: one full-width card at a time with swipe (scroll-snap); the margin opens as a bottom sheet ("N branches").
