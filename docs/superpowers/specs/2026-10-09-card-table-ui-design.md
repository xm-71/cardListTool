# Card-table UI: Shop and Battlefield redesign — build spec

Date: 2026-10-09
Status: Ready for hand-off (owner chose Option 2 of the design review)
Mockups: https://claude.ai/artifact/Ji9TioihjvAd3nnoNoTqCv (Option 2, plus Option 1's phone fixes)

## 1. Goal

Make the Shop and the battlefield easy to use at both phone and desktop width while keeping the game's retro paper-and-ink look.

- **Shop:** find any of the 52 packs quickly. Show what a pack contains and how much of its set you already own before you buy.
- **Battlefield:** the whole game fits one screen on a phone with no scrolling. On desktop the cards are big enough to read. Every action is one tap away in a panel instead of a popup.

### Owner's decisions

| Question                        | Decision                                                                                             |
| ------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Which design                    | Option 2, "card-table layout"                                                                        |
| Include Option 1's phone fixes  | Yes, as phase 1                                                                                      |
| How actions are shown in battle | A selection panel for everything (hand cards and Pokémon in play). The popup `ActionMenu` goes away. |
| Hand-off                        | Spec only for now; an implementation plan comes later                                                |

### Why (findings from the review)

- **Shop:** desktop shows 2 of 52 packs above the fold and a phone shows none. The intro box and the era chips fill the first screen, and on phones the 9 chips wrap to 5 rows.
- **Battlefield on phones:** the page is about 1.7 screens tall (1,473 px at 390×844). End turn sits below the hand, so every turn needs a scroll.
- **Battlefield on desktop:** cards are about 55–68 px wide while half the mat is empty. The "Hover a card to zoom" panel takes a fifth of the screen and never fills on touch.

## 2. Delivery: three phases, one PR each

Each phase ships on its own (PR, green CI, merge, production deploy check) before the next one starts.

1. **Phase 1: phone fixes.** Small changes that remove the worst problems and carry straight into phases 2 and 3.
2. **Phase 2: Shop layout.**
3. **Phase 3: Battlefield layout and the selection panel.**

## 3. Global constraints (apply to every phase)

- **Look:** reuse the existing tokens and utilities in `apps/web/src/index.css`: colours `cream`, `paper`, `ink`, `red`, `blue`, `yellow`, `green`, `purple`, `mat`, `mat-dark`; fonts `font-pixel` (Press Start 2P) and `font-text` (VT323); utilities `retro-box`, `retro-shadow` and `play-mat`. No new colours, fonts or dependencies.
- **Breakpoint:** "phone" means below Tailwind's `lg` (1024 px); "desktop" means `lg` and up. This matches today's code.
- **Phone media query in code:** add `apps/web/src/ui/useIsPhone.ts`, which returns `true` when `matchMedia('(max-width: 1023px)')` matches and listens for changes. It returns `false` when `matchMedia` is missing (jsdom). `useLogOpen.ts` should use it instead of its own query.
- **Accessible names stay stable**, because unit and e2e tests rely on them:
  - regions `Opponent`, `You`, `Your hand` and `Game log`;
  - the buttons `End turn`, `Concede`, `Buy & open`, `Back` and `Done`;
  - one `group` per pack named after the pack;
  - action items as `menuitem`s named by `describeAction` (for example "Play Seviper"), inside a `menu` named after the card;
  - the `Card details` dialog.
- **Accessibility:** every control is reachable by keyboard and has a visible focus ring. Escape closes sheets and clears the selection. Touch targets are at least 40 px tall on phones. Respect `prefers-reduced-motion`; sheets slide in only when motion is allowed.
- **No horizontal page scroll** at any width from 360 px up. Only the rows that are meant to scroll sideways may do so: era chips and the phone hand.
- **Long press** (450 ms, `useLongPress`) still opens the full-size `CardZoom` on every card.
- **No engine or economy behaviour changes.** The one exception is the read-only helper `packContents` in phase 2.
- **Tests:** follow TDD as in the rest of the repo. `pnpm check` must be green, and the Playwright suite must pass with `PW_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome` in cloud sessions.

## 4. Phase 1: phone fixes

### 4.1 Battlefield (phones only; desktop unchanged in this phase)

| Change                          | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Bottom action bar**           | New `apps/web/src/ui/ActionBar.tsx`, fixed to the bottom of the viewport on phones (`lg:hidden`). It adds `env(safe-area-inset-bottom)` to its own padding. Three buttons: **Log** (toggles the log, replacing today's Show/Hide log button), **End turn** (yellow, primary, double width; shown only when `globalActions` includes `endTurn`), and **Menu**. The board gets bottom padding equal to the bar's height so nothing hides behind it. |
| **Shared bottom sheet**         | New `apps/web/src/ui/Sheet.tsx`: a bottom sheet with `role="dialog"`, a title, a × button, Escape and backdrop to close, and focus returned to the button that opened it. Phases 2 and 3 reuse it for every sheet.                                                                                                                                                                                                                                |
| **Menu sheet**                  | **Menu** opens a `Sheet` (`role="dialog"`, name `Game menu`) holding **Concede** (when legal) and **Quit to home**, with the same confirm and Gym rules as today's buttons. On phones the aside's Concede and Quit buttons are hidden; desktop keeps them.                                                                                                                                                                                        |
| **Hand in one row**             | On phones `Hand` becomes a single row that scrolls sideways (`flex-nowrap overflow-x-auto snap-x`), at a card width of `w-16`. Desktop keeps today's behaviour.                                                                                                                                                                                                                                                                                   |
| **Energy stays on its Pokémon** | On phones `SlotView` overlays the Energy chips and Tool on the card's lower edge (today this happens only at `lg`). Remove the `lg:` prefixes from the absolute-positioning classes.                                                                                                                                                                                                                                                              |
| **Compact empty Bench**         | Empty Bench spaces become one dashed outline the size of one bench card with a `+N` count of free spaces, instead of N empty boxes taking a whole row. Desktop keeps the individual spaces until phase 3.                                                                                                                                                                                                                                         |
| **Prompt sheet above the bar**  | While `PromptPanel` is open the action bar is hidden (the prompt has its own Done button), so the two never overlap.                                                                                                                                                                                                                                                                                                                              |

### 4.2 Shop (phones and desktop)

| Change                       | Detail                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Remove the intro box**     | Delete the "Shop" `Box`. The collector-mode text ("every pack is free") moves into a one-line note under the filters, shown only in Collector mode.                                                                                                                                                                                                      |
| **One row of era chips**     | `EraFilter` puts the chips in a single row that scrolls sideways (`flex-nowrap overflow-x-auto`), with a fade on the right edge when there is more. Shorter chip labels on phones: `Mega`, `Classic`, `e-Card`, `EX`, `D&P`, `Platinum`, `HGSS`, `S&V` (keep the full label in `aria-label`). The Binder uses the same component and gets this for free. |
| **Search next to the chips** | On desktop the search box sits at the end of the chip row. On phones it is a `Search` chip that expands into a full-width search box when tapped. Name stays `Search packs` / `Search sets`.                                                                                                                                                             |
| **Smaller pack tiles**       | `PackArt` gets a `size` prop: `'md'` (today's `w-32 h-48`) and `'sm'` (`w-20 h-30`). Shop tiles use `sm`; tile width `w-36` on desktop and two columns on phones (`grid-cols-2`).                                                                                                                                                                        |

### 4.3 Phase 1 acceptance

- At 390×844 on a mid-game board (4 benched Pokémon a side, 7 cards in hand), **End turn is visible without scrolling** and the page has no horizontal scroll.
- At 390×844 the Shop shows **at least 4 pack tiles** above the fold. At 1280×800 it shows **at least 8**.
- At 1280×800 the battlefield looks the same as before phase 1 (the existing fit tests still pass).
- The Binder's set picker is one chip row on phones.

## 5. Phase 2: Shop layout

### 5.1 Desktop (≥ 1024 px): three columns

```
┌ Header: name ············································ ¢ credits ┐
│ ◂ Back   SHOP                                                       │
├──────────────┬────────────────────────────────────┬────────────────┤
│ ERAS         │ CLASSIC · 12 packs · 100¢ each     │  [pack art md] │
│ All      52  │ [tile][tile][tile][tile][tile]     │  BASE SET      │
│ Mega      2  │ [tile][tile][tile][tile][tile]     │  Classic era   │
│ Classic  12 ◀│ [tile][tile]                       │  11 cards: …   │
│ e-Card    3  │                                    │  34/102 owned  │
│ …            │                                    │  ▓▓▓░░░░░░     │
│ ⌕ Search     │                                    │ [BUY & OPEN]   │
└──────────────┴────────────────────────────────────┴────────────────┘
```

- **Era list** (left, `w-56`, `role="group"` named `Filter packs`): `All` plus one row per era with its pack count, as `aria-pressed` buttons. The search box sits at the bottom. This replaces `EraFilter` on desktop; phones keep the phase 1 chip row.
- **Pack grid** (middle, scrolls on its own): a heading with the era name, pack count and price ("Classic · 12 packs · 100¢ each"; prices differ across eras in the "All" view, so it shows no price there). Each tile is a `group` named after the pack and holds the `sm` pack art, the pack name, a progress bar with "34 / 102" and a **Buy & open** button. Clicking anywhere on a tile except the button selects it for the detail panel (`aria-pressed` on the tile's select button).
- **Detail panel** (right, `w-72`, sticky): the `md` pack art, pack name, era, price, contents (`packContents`), progress "34 / 102 collected" with a bar, and a large **Buy & open** button. Before anything is selected it shows the first pack of the current filter.
- **"Open another"** after a pack opening keeps working as today.

### 5.2 Phones (< 1024 px): one list

- The phase 1 chip row and search stay at the top.
- Packs become **list rows** (about 56 px high): small pack art (`w-6 h-9`), the name with its price under it, a progress bar with "34 / 102", and a compact **Buy & open** button. Each row is the pack's `group`.
- Tapping a row (not its button) opens the **pack sheet**: a bottom sheet with the same content as the desktop detail panel and a **Buy & open** button. Escape, the × button or tapping the backdrop closes it.

### 5.3 New helpers

- `packContents(setId: string): string` in `packages/economy/src/packs.ts` describes a pack from its layout. Exact strings:
  - Classic: `11 cards: 7 Common, 3 Uncommon, 1 Rare or Holo Rare`
  - e-Card and EX: `9 cards: 4 Common, 3 Uncommon, 1 reverse holo, 1 Rare or Holo Rare`
  - Diamond & Pearl, Platinum, HGSS: `10 cards: 5 Common, 3 Uncommon, 1 reverse holo, 1 Rare or better`
  - Mega Evolution and Scarlet & Violet: `10 cards: 4 Common, 3 Uncommon, 2 reverse holo, 1 Rare or better`

  A fixed slot whose rarities are exactly Common/Uncommon/Rare is a "reverse holo"; a weighted slot is "Rare or better".

- `setProgress(collection: Record<string, number>, setId: string): { owned: number; total: number }` in `apps/web/src/game/collection.ts`. `owned` counts distinct cards of the set with a count above 0; `total` is `setCards(setId).length`.

### 5.4 Phase 2 acceptance

- At 1280×800 with the "All" filter, **at least 10 pack tiles** are visible without scrolling the page.
- At 390×844 **at least 8 pack rows** are visible below the chips.
- Every pack can be bought from the grid or list, and from the detail panel or sheet. The balance updates and Collector mode still shows FREE.
- The detail panel shows correct contents and progress for a pack from each era (unit test over `PACKS`).

## 6. Phase 3: Battlefield layout and the selection panel

### 6.1 Selection model (both widths)

- New state in `GameScreen`: `selected: { kind: 'hand'; uid: string } | { kind: 'slot'; ref: SlotRef } | null`.
- **Clicking or tapping a card selects it.** That covers hand cards, your Pokémon, the opponent's Pokémon and the top of either discard pile. Clicking the selected card again clears the selection. Escape also clears it.
- **Actions** for the selection come from the existing `actionsForCard` and `actionsForSlot` in `apps/web/src/game/actions.ts`; the opponent's cards have none. When a prompt is open no actions are shown, as today.
- **Default selection:** when your turn starts (no prompt, it is your turn) and after each action you take, the selection resets to your Active Pokémon if you have one, so attacking is always one tap. When the viewer changes (hotseat `PassDevice`) the selection resets.
- The **selected card** gets a yellow ring (`ring-4 ring-yellow`). Cards with available actions keep today's red ring.
- `ActionMenu.tsx` is deleted. Its contents move into `SelectionPanel`.

### 6.2 `SelectionPanel` component (`apps/web/src/ui/SelectionPanel.tsx`)

Props: `view`, `legal`, `selected`, `onAct(action)`, `onDetails(card)`, `onClose()`.

Contents, top to bottom:

1. **Turn status:** "Turn 3 · Your turn" (the same status text as today's banner; the banner itself is removed). When a Stadium is in play, its name follows and tapping it selects the Stadium card (its `useStadium` action shows when legal).
2. **The selected card:** `CardView` at a new size `panel` (`w-40 lg:w-[min(10rem,22vh)]`). For a Pokémon in play it also shows HP left, Special Conditions, attached Energy chips and the Tool.
3. **Actions,** as a `menu` named after the card, with one `menuitem` button per action labelled by `describeAction`:
   - **Attacks** are listed first, one per attack the Pokémon has, with its Energy cost as `EnergyDot`s and its damage. An attack that is not in `legal` is shown disabled (`aria-disabled`, 45% opacity) so the player can see what they are building towards.
   - Then Abilities, Retreat, and the other actions in `legal` order.
4. **Card details** button (opens the existing `CardDetails` dialog).
5. With nothing selected: "Tap a card to see what it can do."

### 6.3 Desktop layout (≥ 1024 px)

```
┌────────────────────────── board (1fr) ──────────────────────┬─ panel (20rem) ─┐
│ OPPONENT  ·  hand 7                                          │ Turn 3 · You    │
│ [P][P]   [b][b][b][b][ ]                       [Deck]        │ [selected card] │
│ [P][P]          [ACTIVE]                       [Discard]     │ ⚪ Playful Kick 20│
│ [P][P]                                                       │ ⚪⚪ Gnaw     40 │
│ ─────────────────────── (Stadium chip if any) ────────────── │ Retreat ⚪       │
│ [P][P]          [ACTIVE]                       [Deck]        │ Card details    │
│ [P][P]   [b][b][b][b][ ]                       [Discard]     │ [ END TURN ]    │
│ [P]                                                          │ Log ▾           │
│ YOU                                                          │ …               │
├──────────────────────────────────────────────────────────────┤ Concede · Quit  │
│ hand: [c][c][c][c][c][c][c]                                  │                 │
└──────────────────────────────────────────────────────────────┴─────────────────┘
```

- **Grid:** `lg:grid-cols-[1fr_20rem]` at `h-dvh`, with no page scroll (as today).
- **Each side is three zones** (`grid-cols-[auto_1fr_auto]`): Prizes on the left, Active and Bench in the middle, and Deck with Discard stacked on the right. The opponent side is mirrored: Bench at the top, Active nearest the middle.
- **Prizes** (new `PrizeGrid.tsx`): the face-down prize cards drawn as a 2×3 grid of `pile`-size card backs, one per prize left, with the count as text for screen readers ("6 Prizes"). Taken prizes leave their space empty, so progress can be read at a glance.
- **Card sizes** (new `CardView` sizes; they scale with window height so 1280×600 still fits):
  - `active`: `lg:w-[min(9rem,14vh)]`
  - `bench`: `lg:w-[min(6.5rem,10vh)]`
  - `hand`: `lg:w-[min(6rem,10vh)]`
  - `pile`: `lg:w-[min(3.5rem,6vh)]` (unchanged)
- **Empty Bench spaces** are dashed outlines at `bench` size, as today.
- **The right column** holds `SelectionPanel` (scrolls on its own if tall), then **End turn** (full width, yellow), then the **log** (collapsible, open by default on desktop and taking the rest of the height), then a footer with **Concede** and **Quit to home**.
- **Removed:** the `Card zoom` panel (`CardPreview`) and the hover preview (`usePreview.show`). Selection replaces hover; long press and right-click still open `CardZoom`. Delete `CardPreview.tsx`, and remove `card`/`show` from `preview.ts`, keeping `zoomed`/`zoom`. Update `review-fixes.test.tsx`, which asserts the zoom panel, to assert the selection panel instead.

### 6.4 Phone layout (< 1024 px): one screen, no page scroll

```
┌ opponent strip ─────────────────────┐   ← tap to open the full opponent board
│ [act] Gloom 80/80  ·  50 50 30 50   │
│ Prizes 6 · Hand 7 · Deck 26 · Disc 4│
├─────────────────────────────────────┤
│              [ACTIVE]               │   your side gets the room
│        [b] [b] [b] [b] (+1)         │
│   Prizes 5 · Deck 31 · Discard 4    │
├─────────────────────────────────────┤
│ selection sheet (when selected)     │   ← up to 45dvh, × to close
├─────────────────────────────────────┤
│ [HAND 7 ▴]   [ END TURN ]   [ ☰ ]   │   ← phase 1 action bar
└─────────────────────────────────────┘
```

- The screen is `h-dvh` with `overflow-hidden`, and the board area flexes.
- **Opponent strip** (new `OpponentStrip.tsx`, region `Opponent`): their Active as a `bench`-size card with HP, their Bench as small HP chips (each a button that selects that Pokémon), and their counts. Tapping the strip's **View board** button opens a full-screen sheet with the opponent's full `Side` (mirrored), dismissable with ×/Escape.
- **Your side** (region `You`): Active at `w-28`, Bench in one row at `w-14` with energy overlaid (phase 1), then a counts line "Prizes 5 · Deck 31 · Discard 4" where Discard is a button that opens the existing `DiscardViewer`.
- **Hand drawer:** the action bar's first button becomes **Hand 7 ▴**. It opens a bottom sheet (region `Your hand`) with the one-row scrolling hand from phase 1. Picking a card selects it, closes the drawer and opens the selection sheet. The hand stays mounted (hidden) when closed so its region still exists for tests and screen readers.
- **Selection sheet:** `SelectionPanel` in a bottom sheet above the action bar, at most 45 dvh, with a × button. It opens whenever something is selected, but not for the automatic default selection at the start of a turn, which only rings the Active. Tapping the Active opens it.
- **Log:** moves into the **☰** menu sheet ("Game log", collapsible) together with Concede and Quit. The phase 1 **Log** button is replaced by **Hand**.
- `PromptPanel` keeps its current bottom-sheet design, and the action bar stays hidden while it is open.

### 6.5 Edge cases

- **No Active** (during setup or after a knock-out before promotion): nothing is selected by default, and the Active space shows the dashed outline.
- **Bench attacks** (`AttackScript.fromBench`): a benched Pokémon with a legal attack lists it in its own panel.
- **Prompt open:** the panel still shows the selected card but no actions; the prompt sheet takes focus.
- **Game over:** selection and sheets close; `GameOver` and `GymGameOver` show as today.
- **Hotseat:** the panel always shows the current viewer's options; the selection resets on `PassDevice`.
- **Stadium:** selectable from the turn status line. Its `useStadium` action appears there.
- **Opponent's hand:** shown only as a count, as today.
- **Very short desktop windows (1280×600):** the board column scrolls (as today), and the hand and End turn stay on screen.

### 6.6 Files

| File                                              | Change                                                                              |
| ------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `src/screens/GameScreen.tsx`                      | Selection state, the new layout for both widths, removes `ActionMenu`/`CardPreview` |
| `src/ui/SelectionPanel.tsx`                       | New                                                                                 |
| `src/ui/PrizeGrid.tsx`                            | New                                                                                 |
| `src/ui/OpponentStrip.tsx`                        | New                                                                                 |
| `src/ui/ActionBar.tsx`                            | From phase 1; gains Hand and loses Log in phase 3                                   |
| `src/ui/Sheet.tsx`                                | From phase 1; also used by the hand, selection, opponent board and pack sheets      |
| `src/ui/Side.tsx`                                 | Three-zone layout, `PrizeGrid`                                                      |
| `src/ui/SlotView.tsx`, `src/ui/CardView.tsx`      | New sizes; `selected` ring                                                          |
| `src/ui/Hand.tsx`                                 | Selection ring; phone row                                                           |
| `src/ui/ActionMenu.tsx`, `src/ui/CardPreview.tsx` | Deleted                                                                             |
| `src/ui/preview.ts`                               | Keeps only `zoomed`/`zoom`                                                          |
| `src/ui/useIsPhone.ts`                            | From phase 1                                                                        |

### 6.7 Phase 3 acceptance

- **Phone, 390×844, mid-game board:** `document.documentElement.scrollHeight <= innerHeight`; End turn, the Active and the whole Bench are visible; attacking takes at most two taps (tap Active, tap attack).
- **Desktop, 1280×800:** your Active card is at least 110 px wide (about 1.6× today) and Bench cards at least 78 px. The existing fit tests at 1280×720, 1366×768, 1440×900 and 1280×600 still pass.
- **Every action reachable today is still reachable:** playing Basics, evolving, attaching Energy and Tools, Trainers with and without targets, Abilities, Stadium use, retreat, attacks (including from the Bench), End turn, Concede and Quit. Cover each with a unit test through `SelectionPanel`.
- Prompts, game over and the Gym result screens behave as today.

## 7. Testing

- **Unit (vitest + Testing Library),** written before each change:
  - `useIsPhone` with and without `matchMedia`;
  - `ActionBar` buttons and the menu sheet (Concede asks to confirm; Quit in a Gym match concedes);
  - `packContents` for every era;
  - `setProgress`;
  - Shop selection, detail panel and pack sheet;
  - the selection model (default to Active, reset after an action, Escape clears, viewer change resets);
  - every action type through `SelectionPanel`;
  - disabled attacks shown;
  - `PrizeGrid` count;
  - `OpponentStrip` selecting an opponent's Pokémon.
- **Tests to update** (behaviour moved, not removed):
  - `board.test.tsx` and `flow.test.tsx`: actions are now in the panel `menu` rather than a popup; the `menuitem` names are the same;
  - `review-fixes.test.tsx`: the zoom panel is replaced by the selection panel;
  - `shop.test.tsx`, `classic.test.tsx`, `pack-again.test.tsx`, `pack-filters.test.tsx`, `nav.test.tsx`, `screens-back.test.tsx`: the Shop structure and chip labels;
  - `mobile-battle.test.tsx`: the log toggle moves into the menu in phase 3.
- **Playwright (`apps/web/e2e/smoke.spec.ts`):**
  - add a 390×844 test per phase asserting the acceptance numbers above (no page scroll, End turn visible, pack counts above the fold);
  - keep the existing desktop fit tests;
  - save screenshots of the Shop and board at both widths to `test-results/` for the PR.

## 8. Out of scope

- Option 3's "Handheld mode" theme (a possible later, optional theme).
- Redesigning `PromptPanel`, `PackOpening`, the Binder book, the Deck Builder and the Gym screens. The Binder only gets the shared one-row chip filter.
- New animations beyond sheet slide-ins.
- Engine, bot or economy rule changes. Pack prices stay as they are.
