# Design Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 15 findings of the 2026-11-12 visual and UX review of the web app, on desktop and phone.

**Architecture:** All changes are in `apps/web` (React 19, Tailwind 4 utility classes, a few rules in
`src/index.css`). Sizes and overlap are checked in a new Playwright spec that runs at a phone and a desktop viewport;
behaviour is checked in the existing vitest + Testing Library suites under `apps/web/test`.

**Tech Stack:** TypeScript, React, Tailwind CSS 4, zustand, vitest (jsdom), Playwright.

**Spec:** `docs/superpowers/specs/2026-11-12-design-fixes-design.md` (read it first: the finding numbers below refer
to its table).

## Global Constraints

- Change only `apps/web` (and this plan's ledger). No change to `packages/*`.
- Keep the retro look: `font-pixel` (Press Start 2P) for labels, `font-text` (VT323) for body text, 4px ink borders,
  `retro-box` and `retro-shadow`. No new fonts, colours outside the tokens in `src/index.css`, or dependencies.
- Both themes: every colour comes from a token that has a light and a dark value in `src/index.css`.
- Smallest readable text: 8px for `font-pixel`, 16px for `font-text`.
- Smallest touch target: 44×44 CSS px (real box size, not an invisible overlay), on viewports narrower than `lg`
  (1024px) and for anything used during a battle.
- Before each commit: `pnpm typecheck && pnpm lint && pnpm test` from the repo root, all green. Before the PR also
  `pnpm --filter @ptcg/web e2e -- --trace off`, all green (the dev server is started by the Playwright config).
- A test that fails because it used an old label or an old layout is updated to the new one, never deleted or
  skipped.
- Branch: `claude/kind-meitner-2p99da`, reset to `origin/master` first if its PR has merged. One PR for the whole
  plan. Do not merge without the user's go-ahead.

## Review Focus

Cases the tasks' tests do not all name and a player would meet:

1. **Dark theme.** Every colour change must read in dark mode too; `e2e/dark.spec.ts` exists and must stay green. The
   contrast test of Task 3 covers both themes.
2. **Short desktop windows.** The battle board must fit at 1280×720 as well as 1280×800 (Task 4 tests both); at
   smaller heights it may scroll but nothing may overlap.
3. **Old labels in tests.** `test/keyboard.test.tsx`, `test/town-menu.test.tsx`, `test/nav.test.tsx`, `e2e/town.spec.ts` and others find
   buildings by their old accessible names ("Shop", "Decks", "Duel"). Task 6 changes the names: run the whole suite
   and the e2e suite after it.
4. **Collector mode** (Options → Collector mode) hides battling: the town and the Trainer Card show fewer places. The
   renamed labels must hold there too (Task 6 has a test).
5. **A set search with the era on "All"** in the Binder: the dropdown lists only the sets that match the search, and
   the selected set stays selected when it is filtered out of view (Task 1).

## File Structure

| File | Change |
|---|---|
| `src/screens/Binder.tsx` | Task 1 (set picker), Task 3 (unowned cards, card numbers), Task 7 (checkbox rows) |
| `src/ui/binder/SetPicker.tsx` (new) | Task 1: the set buttons or the dropdown |
| `src/index.css` | Task 3: `--c-ink-soft` token (light and dark) and `--color-ink-soft` |
| `src/ui/Ticker.tsx`, `src/ui/faceoff/FaceOffBoard.tsx`, `src/ui/GameMenu.tsx`, `src/screens/GameScreen.tsx` | Task 2 (tap targets), Task 4 (desktop board), Task 5 (phone hand) |
| `src/ui/faceoff/HandFan.tsx` | Task 5 |
| `src/game/animation/*`, `src/ui/CardView.tsx` | Task 4: the played-card showcase position (find it with `grep -rn showcase src`) |
| `src/screens/DeckBuilder.tsx` | Task 2 (+/− buttons), Task 3 (card numbers) |
| `src/ui/shop/PackTile.tsx`, `src/screens/Shop.tsx` | Task 6 |
| `src/game/town.ts`, `src/ui/town/TownBuilding.tsx`, `src/ui/town/TrainerCard.tsx` | Task 6 |
| `src/screens/Title.tsx`, `src/screens/Intro.tsx`, `src/screens/OfflineSettings.tsx` | Task 7 |
| `e2e/design.spec.ts` (new) | Sizes and overlap, Tasks 2, 4, 5, 7 |
| `test/design-tokens.test.ts` (new) | Task 3: font-size scan and contrast |

---

### Task 1: Binder set picker (finding 1)

**Files:**
- Create: `apps/web/src/ui/binder/SetPicker.tsx`
- Modify: `apps/web/src/screens/Binder.tsx` (`BinderBody`)
- Test: `apps/web/test/binder.test.tsx`

**Interfaces:**
- Produces: `SetPicker({ sets, era, value, onChange }: { sets: readonly { id: string; name: string; era: EraId }[]; era: EraId | 'all'; value: string; onChange(id: string): void })`.
  With `era !== 'all'` it renders one `button[aria-pressed]` per set in `sets` (the caller passes the sets already
  filtered by era and search). With `era === 'all'` it renders one `<select aria-label="Set">` with an `<optgroup>`
  per era (label from `ERAS`), options in `SETS` order.

- [ ] **Step 1: Write the failing tests** in `test/binder.test.tsx` (use the file's existing render helper):
  - "opens on the era of the first set": the chip `Mega Evolution era` has `aria-pressed="true"`, and the Sets group
    holds exactly as many buttons as `SETS.filter((s) => s.era === 'mega').length` (plus the era chips; count
    `getAllByRole('button', { pressed: ... })` inside a `data-testid="set-picker"` wrapper).
  - "choosing an era shows that era's sets and selects its first set": click `Classic`; the first Classic set's button
    is pressed and the Cards list shows that set's cards.
  - "All shows one dropdown instead of the buttons": click `All`; `getByRole('combobox', { name: 'Set' })` exists,
    has one option per set, and no set button is rendered; choosing an option shows that set's cards.
  - "a search narrows the dropdown" (Review Focus 5): with `All`, type `neo` in Search sets: the options are the
    sets whose name contains "neo"; the Cards list still shows the previously selected set.
- [ ] **Step 2: Run** `pnpm --filter @ptcg/web test -- binder` — Expected: the four new tests FAIL.
- [ ] **Step 3: Implement.** `eraFilter` starts as the era of `SETS[0]`; choosing an era other than `all` calls
  `setSetId` with that era's first set unless the current set is already in it. Render `SetPicker` inside a
  `div[data-testid="set-picker"]` in place of the `flex flex-wrap` button list.
- [ ] **Step 4: Run** the same command — Expected: PASS; then the whole `apps/web` suite.
- [ ] **Step 5: Commit** — `Binder: the era filters the sets; "All" shows a dropdown`.

### Task 2: 44px tap targets (findings 2, 3, 12)

**Files:**
- Modify: `src/ui/Ticker.tsx` (Log and Skip buttons), `src/ui/faceoff/FaceOffBoard.tsx` (Discard button near line
  150), `src/ui/GameMenu.tsx` and its phone trigger in `src/screens/GameScreen.tsx` (near line 190),
  `src/screens/DeckBuilder.tsx` (the `Add …` button near line 279 and the matching `Remove …` button)
- Create: `apps/web/e2e/design.spec.ts`

**Interfaces:**
- Produces in `e2e/design.spec.ts`: `const PHONE = { viewport: { width: 390, height: 844 }, hasTouch: true }`,
  `const DESKTOP = { viewport: { width: 1280, height: 800 } }`, and helpers `startDuel(page)` (title → town → Duel
  Hall → Play → answer setup prompts until it is the player's turn) and `box(locator)` (bounding box, asserts it is
  not null). Later tasks add tests to this file and use these. Model `startDuel` on `e2e/smoke.spec.ts`.

- [ ] **Step 1: Write the failing e2e tests** (`test.describe('phone', …)` with `test.use(PHONE)`):
  - "battle controls are at least 44×44": after `startDuel`, the buttons named `Menu`, `Log`, `End turn` and both
    `Discard N` buttons each have `width >= 44 && height >= 44`.
  - "deck builder add and remove buttons are at least 44×44": Deck Lab → New deck; the first `Add …` button, and
    after clicking it the `Remove …` button.
  - desktop block: "Skip is at least 44×28" during the opponent's turn (use `test.use(DESKTOP)`; skip the assertion
    if the button never appears within 5 s — the bot may be instant — and say so in a comment).
- [ ] **Step 2: Run** `pnpm --filter @ptcg/web e2e -- design --trace off` — Expected: FAIL on sizes.
- [ ] **Step 3: Implement** with real box sizes (`min-h-11 min-w-11`, centred content) on the listed controls. The
  ticker bar may grow to 44px on phones; desktop keeps its height (`lg:` variants).
- [ ] **Step 4: Run** the e2e command — Expected: PASS; then `pnpm test` (snapshot-free suite: class changes should
  not break it; fix any test that asserted an exact class).
- [ ] **Step 5: Commit** — `Battle and deck builder: 44px tap targets`.

### Task 3: Text size floor and readable secondary text (findings 8, 9)

**Files:**
- Modify: `src/index.css` (tokens), every `text-[5px]`, `text-[6px]`, `text-[7px]` outside `src/ui/pack/PackArt.tsx`
  (list them with `grep -rn "text-\[[5-7]px\]" src`), and the text that uses `opacity-50`/`opacity-60`/`opacity-70`
  for secondary copy: `Binder.tsx:132`, `DeckBuilder.tsx:264,268,274`, `OfflineSettings.tsx:115`,
  `ui/shop/EraList.tsx:34,46`, `Title.tsx:61`, `ui/faceoff/HandFan.tsx:29`, `ui/Hand.tsx:22`; the locked leader card
  in `GymChallenge.tsx:69`; unowned cards in `Binder.tsx:128`
- Create: `apps/web/test/design-tokens.test.ts`

**Interfaces:**
- Produces: CSS custom property `--c-ink-soft` with a light and a dark value, exposed as Tailwind colour
  `ink-soft` (`--color-ink-soft: var(--c-ink-soft)` in the `@theme` block), used as `text-ink-soft`.

- [ ] **Step 1: Write the failing tests** in `test/design-tokens.test.ts` (plain Node `fs` reads, no rendering):
  - "no pixel text under 8px": no file under `src` except `ui/pack/PackArt.tsx` matches `/text-\[[1-7]px\]/`.
  - "ink-soft has 4.5:1 contrast on paper and cream in both themes": parse `src/index.css` for `--c-ink-soft`,
    `--c-paper`, `--c-cream` in the light block and the dark block, compute the WCAG contrast ratio (relative
    luminance formula; write a 15-line helper in the test), expect all four ratios `>= 4.5`.
  - "secondary text does not use opacity": the files listed above contain no `opacity-50`, `opacity-60` or
    `opacity-70` on a text element (assert per file that the class no longer appears, except
    `disabled:opacity-*`).
- [ ] **Step 2: Run** `pnpm --filter @ptcg/web test -- design-tokens` — Expected: three FAIL.
- [ ] **Step 3: Implement.** Raise the small sizes to `text-[8px]` (check each place still fits: badges may need
  `px-0.5` or `leading-none`). Replace the opacity classes with `text-ink-soft`. Unowned Binder cards:
  `opacity-60 grayscale`. Locked Gym leaders: keep the card's art dimmed but give the name and type full-contrast
  text (`text-ink-soft`), dim only the portrait and the border.
- [ ] **Step 4: Run** the test, then `pnpm test`, then `pnpm --filter @ptcg/web e2e -- dark --trace off` (Review
  Focus 1) — Expected: PASS.
- [ ] **Step 5: Commit** — `Readable text: 8px floor and an ink-soft token instead of opacity`.

### Task 4: Desktop battle board (findings 4, 6)

**Files:**
- Modify: `src/screens/GameScreen.tsx` (the `lg:` grid near lines 210–230), the board components it renders
  (`src/ui/Side.tsx`, `src/ui/SlotView.tsx`) and the played-card showcase (find with `grep -rn showcase src`)
- Test: `apps/web/e2e/design.spec.ts`

**Interfaces:**
- Consumes: `DESKTOP`, `startDuel`, `box` from Task 2.

- [ ] **Step 1: Write the failing e2e tests** (desktop block; run each at 1280×800 and 1280×720 with a loop):
  - "the whole board is visible without scrolling": the bottom of `section[aria-label="You"]`'s last Bench slot
    (`[aria-label="Empty Bench space"]` or a Benched Pokémon) is `<=` the top of the hand region, and the board
    container's `scrollHeight <= clientHeight`.
  - "the played-card showcase does not cover an Active Pokémon": play a Trainer card from the hand (or wait for the
    opponent's), and while the showcase element is visible its box does not intersect either Active slot's box. Add
    `data-testid="showcase"` to the element and `data-testid="active-you"` / `"active-opponent"` to the Active slots
    if they have no stable hook yet.
- [ ] **Step 2: Run** `pnpm --filter @ptcg/web e2e -- design --trace off` — Expected: FAIL.
- [ ] **Step 3: Implement.** Size the desktop board from the viewport height (card height as a `clamp()` of `dvh`
  rather than a fixed rem) so two Benches and two Actives fit; place the showcase in the right-hand column over the
  card-preview panel (or beside the board), not over the play area.
- [ ] **Step 4: Run** the e2e command and `e2e -- animations` — Expected: PASS.
- [ ] **Step 5: Commit** — `Battle (desktop): the board fits the window; played cards show beside it`.

### Task 5: Phone hand (finding 5)

**Files:**
- Modify: `src/ui/faceoff/HandFan.tsx`, `src/ui/faceoff/FaceOffBoard.tsx` (the hand label)
- Test: `apps/web/e2e/design.spec.ts`

- [ ] **Step 1: Write the failing e2e tests** (phone block):
  - "a selected hand card stays on screen and off the label": tap the first hand card; its box is inside the
    viewport (`y >= 0`, `y + height <= 844`) and does not intersect the box of the `Hand N` label.
  - "hand cards are not cut off": every hand card's box bottom is `<= 844`.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement**: reserve room above the fan for the raised card and put the label above that room (or to
  the side); keep the fan inside the safe area (`pb-[env(safe-area-inset-bottom)]`).
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** — `Battle (phone): the hand fan keeps its label and stays on screen`.

### Task 6: Shop tiles and one name per place (findings 7, 10)

**Files:**
- Modify: `src/ui/shop/PackTile.tsx`, `src/screens/Shop.tsx`, `src/game/town.ts` (`label` values),
  `src/ui/town/TrainerCard.tsx` (button labels near line 92)
- Test: `apps/web/test/shop-layout.test.tsx`, `apps/web/test/town-menu.test.tsx`,
  `apps/web/test/keyboard.test.tsx`, `apps/web/e2e/town.spec.ts` (other tests that click a tile's `Buy & open` on
  desktop: `grep -ln "Buy & open" apps/web/test`)

- [ ] **Step 1: Write the failing tests:**
  - Shop, desktop (`matchMedia` mocked to not-phone, as the existing Shop tests do): "a pack tile has no button of its
    own": inside the Packs list there is no `Buy & open` button; clicking a tile shows it in the detail panel, and
    the panel's `Buy & open` buys that pack. Phone: each row still has its `Buy & open`.
  - Town: "each building's accessible name is its sign": for every building in `BUILDINGS` (`src/game/town.ts`),
    `getByRole('menuitem', { name: b.sign })` exists; the same in Collector mode for the buildings shown there
    (Review Focus 4).
  - Trainer Card: buttons named `Gym`, `Frontier`, `Deck Lab`, `Deck Case`.
- [ ] **Step 2: Run** `pnpm --filter @ptcg/web test` — Expected: the new tests FAIL.
- [ ] **Step 3: Implement.** Set each `label` in `town.ts` to its `sign` (if nothing else reads `label`, remove the
  field and use `sign`). Update every test and e2e spec that looked a building up by the old name (Review Focus 3).
- [ ] **Step 4: Run** `pnpm test` and `pnpm --filter @ptcg/web e2e -- --trace off` — Expected: PASS.
- [ ] **Step 5: Commit** — `Shop: desktop tiles select, the panel buys; town: one name per place`.

### Task 7: Minor polish (findings 11, 13, 14, 15)

**Files:**
- Modify: `src/screens/Binder.tsx` (checkbox labels), `src/screens/Title.tsx`, `src/screens/Intro.tsx`,
  `src/screens/OfflineSettings.tsx` (the `Card art by era` list near line 108)
- Test: `apps/web/e2e/design.spec.ts`, `apps/web/test/app.test.tsx` (or the Title test)

- [ ] **Step 1: Write the failing tests:**
  - e2e phone: "Binder filter rows are at least 44px tall" (the `Owned only` and `Playable only` labels) and the
    checkboxes are at least 20×20.
  - e2e desktop: "the title is centred": the vertical centre of the title block is within 80px of the viewport's
    centre (400 at 800px height); the same for the Intro dialog box.
  - unit: "the title says TAP TO START on a touch device": with `matchMedia('(pointer: coarse)')` mocked to match,
    the text is `TAP TO START`; otherwise `PRESS START`.
  - e2e desktop: "each era row puts its button on the right": in Options, for every `li` of the `Card art by era`
    list the button's `x` is greater than the text's `x + width` and all buttons share the same right edge (±2px).
- [ ] **Step 2: Run** unit and e2e — Expected: FAIL.
- [ ] **Step 3: Implement.** Era rows: `grid grid-cols-1 sm:grid-cols-[1fr_auto] items-center gap-2`.
- [ ] **Step 4: Run** `pnpm typecheck && pnpm lint && pnpm test` and the whole e2e suite — Expected: PASS.
- [ ] **Step 5: Commit** — `Polish: centred title, touch wording, era rows, Binder filters`.

---

## Finish

1. Take a screenshot of each changed screen at 1280×800 and 390×844 (light theme; one battle screenshot in dark) and
   look at them: nothing clipped, nothing overlapping, text readable. Attach them or list what was checked in the PR.
2. Open one PR to `master` with: the finding numbers fixed, anything not fixed and why, and the test commands run.
3. Wait for CI, then ask the user before merging.
