# Design fixes (visual and UX review, 2026-11-12)

Result of a visual and UX review of the whole web app (`apps/web`) at desktop 1280×800 and phone 390×844. The app
was run locally and every town building was opened; a battle was started but not played to the end. Pack opening,
game over, the Deck Case and dark mode were **not** looked at, so they have no findings here (they must still not
regress).

The retro Game Boy look stays. These are fixes inside that style, not a redesign.

## Findings to fix

Severity: C = critical, M = moderate, m = minor.

| # | Sev | Where | Finding | Decision |
|---|---|---|---|---|
| 1 | C | Binder → All cards | About 60 set buttons fill the first screen on desktop and several screens on a phone (page about 13,000px tall) before any card shows. | The era chips filter the set buttons. The screen opens on the era of the selected set, not on "All". With "All" chosen, the set buttons are replaced by one dropdown grouped by era. |
| 2 | C | Battle, phone | Tap targets too small: Menu 52×24, Log 37×17, Discard 58×16 (px). | Every one is at least 44×44. |
| 3 | C | Deck builder | The "+" (and "−") buttons are 32×20 on both sizes. | At least 44×44. |
| 4 | M | Battle, desktop | At 1280×800 your Bench is half hidden under the hand bar; the board has to be scrolled. | The whole board (both Benches, both Actives) fits without scrolling at 1280×800 and at 1280×720. |
| 5 | M | Battle, phone | A selected hand card rises over the "HAND 7" label; the fanned cards are cut off by the bottom edge. | Label never overlapped; a raised card is fully on screen. |
| 6 | M | Battle, desktop | The opponent's played card is shown large over the middle of the board and covers the Active Pokémon. | The played-card showcase does not overlap either Active Pokémon. |
| 7 | M | Shop, desktop | Each of the 62 pack tiles has its own 84×27 "Buy & open" button, and the detail panel has a large one too. | Desktop tiles lose their button: a click selects the tile, the detail panel buys. The phone list keeps its per-row button (it is already 44px tall or is made so). |
| 8 | M | Everywhere | Pixel font at 5, 6 and 7px (19 places in `apps/web/src`). | 8px is the smallest size for readable text. The lettering drawn on pack art (`ui/pack/PackArt.tsx`) is artwork and is exempt. |
| 9 | M | Everywhere | Secondary text and locked or unowned states are made by opacity (35–60%) and are hard to read: locked Gym leaders, card numbers ("#054"), "about 67 MB", unowned Binder cards. | Secondary text uses a colour token with at least 4.5:1 contrast on `paper` and `cream` in the light and the dark theme. Unowned Binder cards stay greyscale but at 60% or more. Locked Gym leader names and types reach 4.5:1. |
| 10 | M | Town | A building's sign and its accessible name differ: "Poké Mart"/"Shop", "Deck Lab"/"Decks", "Duel Hall"/"Duel", "Gym"/"Gym Challenge", "Frontier"/"Battle Frontier". The Trainer Card buttons use a third set. | One name per place: the sign. `aria-label` equals the sign text; the Trainer Card buttons read "Gym", "Frontier", "Deck Lab", "Deck Case". |
| 11 | m | Binder | "Owned only" and "Playable only" checkboxes are 13×13 with 28px-tall labels. | Label rows at least 44px tall; the box at least 20×20. |
| 12 | m | Battle, desktop | The top ticker button "Skip" is 59×17. | At least 44px wide and 28px tall on desktop (mouse), 44×44 on touch. |
| 13 | m | Title, Intro | On desktop the content sits at the top and the lower half of the screen is empty. | Centred vertically. |
| 14 | m | Title | "PRESS START" on a touch device. | "TAP TO START" when the primary pointer is coarse. |
| 15 | m | Options → Offline play | The per-era download buttons sit sometimes beside and sometimes under their text. | One row per era on a two-column grid: text left, button right; stacked on a phone. |

## Not findings

- The starter-deck picker's third card looked raised in the review: that was the mouse hover state. No change.
- The era chips' abbreviations (D&P, HGSS) already carry the full name as `aria-label`. No change.

## Out of scope

Engine, cards, economy and bots packages; new features; the screens not reviewed. The code review of the same date
(`docs/reviews/2026-11-12-code-base-review.md`) has its own follow-ups and is not part of this work.
