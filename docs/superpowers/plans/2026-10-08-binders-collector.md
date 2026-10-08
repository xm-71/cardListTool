# Custom Binders and Collector Mode — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let players build decorated 9-pocket binders of their own cards, and add a Collector mode where packs are free and battling is hidden.

**Architecture:**

- **Profile data:** binders and the collector flag live in the existing `Profile`, saved in IndexedDB through the queued `change()`.
- **Binder rules:** pure functions in `src/profile/binders.ts`.
- **Binder UI:** new components under `src/ui/binder/`. `Binder.tsx` gets two tabs.
- **Collector mode:** read from the profile by the menu, Shop and Header.

**Tech Stack:** React 19, Zustand 5, Tailwind 4, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-08-binders-collector-design.md`

## Global Constraints

- **Binder fields:**
  - `name`: 1–20 characters, default "My binder";
  - colours: `red | blue | yellow | green | purple | ink | cream | pink`;
  - backgrounds: `plain | pokeball | stripes | stars | grid | energy`;
  - sticker spots: `topLeft | topRight | bottomLeft | bottomRight`;
  - stickers: `pokeball | star | heart | crown | flame | leaf | drop | bolt`.
- **Limits:**
  - pages have exactly 9 slots;
  - there is always at least 1 page;
  - at most 50 binders (`MAX_BINDERS`) and 40 pages per binder (`MAX_PAGES`).
- **Ownership:** a binder holds a card at most as many times as you own it. Different binders may reuse the same card.
- **Art:** no image files. Sticker and background art is inline SVG or CSS in `src/ui/binder/art.tsx`, using palette CSS variables.
- **Collector mode:**
  - packs are free and credits are never spent or shown;
  - the menu shows only Shop, Binder and Options;
  - same collection as normal play;
  - credits are unchanged when the mode is turned off;
  - the intro is unchanged.
- **Styling:** use the retro kit (`Box`, `Button`, `Menu`) and palette tokens.
- **Saving:** every profile write goes through `change()` in `useProfile.ts`.

## Review Focus

1. **Old saves and corrupt binder data:**
   - a profile without `binders`/`collectorMode`, or with bad colours or ragged pages, must load and normalize, not crash.
   - Test: Task 1, `normalizeProfile` cases.
2. **Owning fewer copies than a binder uses** (for example a hand-edited save): the extra slots render as "missing". Nothing is deleted and nothing crashes.
   - Test: Task 1 `missingSlots`, plus Task 5's render test.
3. **Two tabs editing binders:** a binder saved in tab A must not be lost when tab B saves a different binder.
   - `saveBinder` merges by id inside `change()`.
   - Test: Task 2.
4. **Collector mode while a game or Shop purchase is in flight:**
   - turning it on must not cancel an open pack;
   - a route already on Duel or Decks redirects to the menu.
   - Test: Task 3 nav guard.
5. **Phone width (375 px):** the open binder shows one page, and the picker and editor don't scroll sideways.
   - Test: Task 6 e2e.

---

### Task 1: Binder data and rules

**Files:**

- Modify: `apps/web/src/profile/types.ts`
- Create: `apps/web/src/profile/binders.ts`
- Test: `apps/web/test/binders.test.ts`

**Interfaces:**

- Produces in `types.ts`:
  - types `BinderColor`, `BinderBackground`, `StickerSpot`, `StickerId`;
  - `CustomBinder { id; name; coverColor; pageColor; background; stickers: Partial<Record<StickerSpot, StickerId>>; pages: (string | null)[][]; updatedAt: number }`;
  - `Profile` gains `binders: CustomBinder[]` and `collectorMode: boolean`;
  - constants `BINDER_COLORS`, `BINDER_BACKGROUNDS`, `STICKER_SPOTS`, `STICKERS` (readonly arrays).
- Produces in `binders.ts`:
  - `MAX_BINDERS = 50`, `MAX_PAGES = 40`, `SLOTS_PER_PAGE = 9`;
  - `newBinder(id: string, now: number): CustomBinder`: defaults are name "My binder", cover `red`, pages `cream`, `plain`, no stickers, 1 empty page;
  - `normalizeBinder(raw: unknown): CustomBinder | null`;
  - `placementsLeft(b, cardId, collection): number`;
  - `placeCard(b, page, slot, cardId, collection): CustomBinder` (returns `b` unchanged when it's refused);
  - `moveCard(b, from: SlotPos, to: SlotPos): CustomBinder` (a swap);
  - `removeCard(b, page, slot)`, `addPage(b)` and `removePage(b, page)`, each returning `CustomBinder`;
  - `missingSlots(b, collection): Set<string>`, with keys `"page:slot"`;
  - `cardCount(b): number`;
  - `type SlotPos = { page: number; slot: number }`.

  All functions are pure. They never mutate their input and don't set `updatedAt`; the store does that.

- [ ] **Step 1: Failing tests** in `binders.test.ts`:
  - `newBinder('b1', 5)` deep-equals the defaults, with `pages: [Array(9).fill(null)]` and `updatedAt: 5`.
  - **Placement:** owning 2 of `me01-131`, placing it in 2 slots works; a 3rd `placeCard` returns the same object, and `placementsLeft` is 0.
  - **Overwrite:** placing onto an occupied slot replaces that card, and the replaced card's placement is freed.
  - **Move:** `moveCard` swaps two filled slots, and also moves a card into an empty slot.
  - **Pages:**
    - `addPage` stops adding at 40 pages;
    - `removePage` drops that page's cards;
    - `removePage` on the only page returns the input unchanged.
  - **Missing:** a binder using 3 copies of a card you own 1 of gives `missingSlots` size 2. The last two by page/slot order are the missing ones.
  - **`normalizeBinder`:**
    - an unknown colour becomes the default;
    - a page with 5 entries is padded to 9, and one with 12 is trimmed to 9;
    - `pages: []` becomes 1 empty page;
    - a non-string card id becomes `null`;
    - a name longer than 20 characters is cut to 20, and an empty name becomes "My binder";
    - an unknown sticker is dropped;
    - `null` input returns `null`.
  - **`normalizeProfile`:**
    - `{version: 1}` gets `binders: []` and `collectorMode: false`;
    - a profile with one bad binder entry (`"x"`) keeps only the valid binders;
    - more than 50 binders are cut to 50.
- [ ] **Step 2:** Run `npx vitest run --project web apps/web/test/binders.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3:** Implement the types, `binders.ts`, and `normalizeProfile`. `normalizeProfile` maps `raw.binders` through `normalizeBinder`, filters out nulls, slices to `MAX_BINDERS`, and coerces `collectorMode` with `=== true`. `newProfile()` gets `binders: []` and `collectorMode: false`.
- [ ] **Step 4:** Run the test, then `pnpm check`. Expected: PASS and green.
- [ ] **Step 5:** Commit `feat(web): binder data model and rules`.

### Task 2: Profile store actions

**Files:**

- Modify: `apps/web/src/profile/useProfile.ts`
- Test: `apps/web/test/profile.test.ts`

**Interfaces:**

- Consumes: Task 1's types and `MAX_BINDERS`.
- Produces on `ProfileState`:
  - `saveBinder(b: CustomBinder): Promise<void>`: merges by id inside `change()`, sets `updatedAt = Date.now()`, and refuses a new id when there are already 50 binders;
  - `deleteBinder(id: string): Promise<void>`;
  - `setCollectorMode(on: boolean): Promise<void>`;
  - `buyPack(setId)` is free when `profile.collectorMode` is true. It doesn't check credits and doesn't change them.

- [ ] **Step 1: Failing tests:**
  - `saveBinder` adds a binder, and a second save with the same id replaces it.
  - **Two tabs** (Review Focus 3): two stores share one memory store. Tab A saves binder `a` and tab B saves binder `b`, and the stored profile has both.
  - The 51st new binder is not added.
  - `deleteBinder` removes it.
  - `setCollectorMode(true)` with 0 credits lets `buyPack('me01')` succeed. Credits stay 0 and the collection grows by the pack size.
  - Turning collector mode off keeps the credits as they were.
- [ ] **Step 2:** Run `npx vitest run --project web apps/web/test/profile.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement the actions in `useProfile.ts`.
- [ ] **Step 4:** Run the test and `pnpm check`. Expected: green.
- [ ] **Step 5:** Commit `feat(web): binder and collector-mode profile actions`.

### Task 3: Collector mode UI

**Files:**

- Modify:
  - `apps/web/src/screens/Options.tsx`
  - `apps/web/src/screens/MainMenu.tsx`
  - `apps/web/src/screens/Shop.tsx`
  - `apps/web/src/ui/retro/Header.tsx`
  - `apps/web/src/App.tsx`
- Test: `apps/web/test/collector.test.tsx`

**Interfaces:**

- Consumes: `setCollectorMode` and `profile.collectorMode` (Task 2); `BinderCover` is not needed yet. The menu uses a Poké Ball when there are no binders, and Task 4 swaps in the latest binder's cover.
- Produces: `COLLECTOR_ITEMS` (Shop, Binder, Options) and `COLLECTOR_TIPS` in `MainMenu.tsx`.

- [ ] **Step 1: Failing tests:**
  - **Options:**
    - the checkbox labelled "Collector mode" exists, with the hint "Free packs. Battling is hidden.";
    - checking it saves `collectorMode: true`.
  - **Menu:** with collector mode on, the menu items are exactly Shop, Binder and Options.
  - **Shop:**
    - with collector mode on and 0 credits, every pack shows "FREE" and its buy button is enabled;
    - the header doesn't contain "credits".
  - **Nav guard** (Review Focus 4): with collector mode on, `useNav.go('duel')` renders the main menu, and so does `go('decks')`.
  - **Off again:** turning collector mode off shows Duel and Decks again.
- [ ] **Step 2:** Run `npx vitest run --project web apps/web/test/collector.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement.
  - The **guard** goes in `App.tsx`'s route switch: `duel`/`decks` with `collectorMode` render `MainMenu` and call `go('menu')` in an effect.
  - The **Header** hides the credits text when `collectorMode` is on.
  - Collector **tips** are:
    - "Packs are free in Collector mode — rip away!"
    - "Fill a binder page with your favourite pulls."
    - "Decorate binder covers with stickers."
- [ ] **Step 4:** Run the test and `pnpm check`. Expected: green.
- [ ] **Step 5:** Commit `feat(web): collector mode`.

### Task 4: Binder art, cover and cover editor

**Files:**

- Create:
  - `apps/web/src/ui/binder/art.tsx`
  - `apps/web/src/ui/binder/BinderCover.tsx`
  - `apps/web/src/ui/binder/CoverEditor.tsx`
- Modify: `apps/web/src/screens/MainMenu.tsx` (collector cover)
- Test: `apps/web/test/binder-cover.test.tsx`

**Interfaces:**

- Consumes: Task 1's types; `saveBinder`/`deleteBinder` (Task 2).
- Produces:
  - `COLOR_VAR: Record<BinderColor, string>`, mapping to CSS variables with the new `--color-pink` added in `index.css`;
  - `Background({ kind, color })`: an absolutely-positioned SVG or CSS pattern layer;
  - `Sticker({ id, size })`: inline SVG with `role="img"` and `aria-label` set to the sticker name;
  - `BinderCover({ binder, size: 'sm' | 'lg' })`: cover colour, background, stickers in their spots, the name, and "N cards";
  - `CoverEditor({ binder, onSave(b), onDelete(), onClose() })`: a dialog labelled "Edit binder".

- [ ] **Step 1: Failing tests:**
  - **Cover:** `BinderCover` for a binder with stickers `{topLeft: 'star', bottomRight: 'heart'}` shows images named "star" and "heart", the name, and "0 cards".
  - **Editor fields:** in `CoverEditor`, changing the name, picking cover colour "blue" (radio) and background "stars" updates the live preview (the preview's `data-color="blue"` and `data-background="stars"`). Save calls `onSave` with those values.
  - **Stickers:** picking "None" for a spot removes its sticker.
  - **Delete:** asks to confirm (a `confirm` stub returning false means no `onDelete`; true calls it).
  - **Name:** an empty name saves as "My binder".
  - **Menu:** with collector mode on and one binder, the menu figure shows that binder's cover. With none, it shows the Poké Ball.
- [ ] **Step 2:** Run `npx vitest run --project web apps/web/test/binder-cover.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement. The 8 stickers and 5 non-plain backgrounds are simple pixel-style SVGs, 16×16 viewBox, `shape-rendering="crispEdges"`.
- [ ] **Step 4:** Run the test and `pnpm check`. Expected: green.
- [ ] **Step 5:** Commit `feat(web): binder covers and cover editor`.

### Task 5: My binders tab and the open binder

**Files:**

- Create:
  - `apps/web/src/ui/binder/BinderShelf.tsx`
  - `apps/web/src/ui/binder/BinderBook.tsx`
  - `apps/web/src/ui/binder/CardPicker.tsx`
- Modify: `apps/web/src/screens/Binder.tsx` (tabs "All cards" and "My binders"; the current body becomes the All cards tab, unchanged)
- Test: `apps/web/test/my-binders.test.tsx`

**Interfaces:**

- Consumes: Tasks 1, 2 and 4.
- Produces:
  - `BinderShelf({ onOpen(id) })`: covers plus a "New binder" button, which is disabled at 50. New opens the `CoverEditor`.
  - `BinderBook({ binderId, onBack })`. It shows:
    - a 2-page spread at `lg` and wider, 1 page below that;
    - "Page N / M";
    - ◀ ▶ buttons named "Previous page" and "Next page", plus the arrow keys;
    - "Add page" (disabled at 40) and "Remove page" (asks to confirm, hidden with 1 page);
    - "Edit cover".

    Each slot is a button: "Empty slot N" or the card name. A missing slot renders greyed with the label "{name} (missing)".

  - `CardPicker({ binder, onPick(cardId), onClose })`: a dialog "Choose a card". It has a name search box and a set `<select>`, and lists only owned cards. A card with `placementsLeft` 0 is disabled.
  - **Filled-slot menu:** View (`CardDetails`), Move, Remove.
    - Move sets a "moving" state where the slot buttons are labelled "Move here: …";
    - clicking one calls `moveCard`;
    - Escape cancels.
  - Every edit calls `saveBinder` with the rule function's result.

- [ ] **Step 1: Failing tests** (profile pre-seeded with owned `me01-131` ×1 and `me01-077` ×1):
  - **Create:** My binders → New binder → Save, and one cover is on the shelf. Open it to see "Page 1 / 1" and 9 "Empty slot" buttons.
  - **Pick and save:** Empty slot 1 → picker → choose Ultra Ball, and slot 1 shows Ultra Ball. Ultra Ball is disabled in the picker for slot 2. The stored profile has the card at `pages[0][0]`.
  - **Pages:** Add page, then Next page shows "Page 2 / 2". Remove page asks to confirm and goes back to 1 page.
  - **Move:** Move slot 1 to Empty slot 5, and slot 5 is filled while slot 1 is empty.
  - **Remove:** removing a card empties its slot.
  - **Missing** (Review Focus 2): a binder with `me01-131` in 2 slots, while you own 1, renders "Ultra Ball (missing)" once.
- [ ] **Step 2:** Run `npx vitest run --project web apps/web/test/my-binders.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the test and `pnpm check`. Expected: green, and the existing `binder.test.tsx` still passes (All cards is unchanged).
- [ ] **Step 5:** Commit `feat(web): my binders`.

### Task 6: End-to-end, review and ship

**Files:** Modify `apps/web/e2e/smoke.spec.ts`.

- [ ] **Step 1: New e2e test** "collector mode: free pack into a new binder, kept after reload":
  1. Title, Skip, Options, check "Collector mode", Back. The menu has no Duel item.
  2. Shop: buy (FREE) a Mega Evolution pack and Reveal all, Done.
  3. Binder, My binders, New binder, Save, then open it.
  4. Empty slot 1, then pick the first enabled card.
  5. Reload, then the title. Binder, then My binders: the binder shows "1 card".
  6. Screenshots: `binder-shelf.png`, `binder-book.png`, `binder-editor.png`.
- [ ] **Step 2:** Add "My binders" (shelf plus an open book) to the 375 px no-scroll test (Review Focus 5).
- [ ] **Step 3:** Run `PW_CHROMIUM=/opt/pw-browsers/chromium npx playwright test` and `pnpm check`. Expected: all green. Look at the screenshots.
- [ ] **Step 4:** Commit `test(web): binders and collector mode e2e`.
- [ ] **Step 5:** Whole-branch review by a fresh reviewer, a test-first fix pass, then PR, green CI, merge and a production deploy check.
