# Owning and Buying Premade Decks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Players own their starter, buy other premade decks (deck + its 60 cards) in a new Poké Mart Decks tab, and
Duel and Gym offer only owned decks plus valid custom decks.

**Architecture:** A pure module (`src/profile/ownedDecks.ts`) owns the save rules: the upgrade of old saves, granting
a deck, and the purchase checks. The profile store calls it from `normalizeProfile`, `finishIntro` and a new `buyDeck`.
The catalog gains `ownedDeckSources` for the player's choices. `DECKS` and `deckSources` stay the full lists for bots,
hotseat player 2 and resolving games. The Shop gets Packs/Decks tabs; the Decks tab reuses `Sheet` and `RunDeckView`.

**Tech Stack:** React 19, Zustand, Tailwind 4, vitest + Testing Library, Playwright. pnpm monorepo
(`@ptcg/economy`, `apps/web`).

**Spec:** `docs/superpowers/specs/2026-10-13-deck-ownership-design.md`

## Global Constraints

- Prices: starter **300**, theme **600**, meta **1,200** credits.
- A finished intro always owns its starter. Mega Gengar (`'mega-gengar'`) is the fallback when the starter is missing or unknown.
- A deck's 60 cards are added to the collection exactly once: when it is granted (intro or upgrade) or bought.
- Each deck can be bought once. Collector mode doesn't sell decks: the Decks tab is hidden and `buyDeck` refuses.
- `DECKS` stays the bots' pool. Duel bots and hotseat player 2 use every premade deck.
- An Elite Four run in progress keeps its locked deck (`gym.run.deck`), owned or not. Battle Frontier is unchanged.
- Copy:
  - Tabs: "Packs", "Decks".
  - Button: "Buy for N credits", with N formatted `toLocaleString('en-US')`.
  - When unaffordable: "Not enough credits".
  - After buying: "Added to your decks. 60 cards added to your binder."
  - Badge: "OWNED".
- Commit trailer:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01WFz6tSKDh8teWBCgcvMmLs
  ```
- Run `pnpm check` from the repo root before the final review.

## Review Focus

1. **Test profiles built with `{ ...newProfile(), introDone: true }` and no `starterDeck`** must still own Mega
   Gengar. The upgrade applies whenever the intro is done and nothing is owned. This keeps existing screen tests and
   real old saves working. Task 2 pins it.
2. **A save saved, loaded, saved and loaded again** must not grant the starter's cards twice. Task 2 pins it.
3. **The player's default deck (`starterDeck`) when it isn't in the owned list** (an unknown id from an old save)
   must fall back to the first owned deck, not crash or pick an unowned deck. Task 4 pins it.
4. **Double-clicking Buy**: the second press must not charge twice. `buyDeck` refuses when the deck is already
   owned, and the button is disabled while busy. Task 5 pins it.
5. **Existing tests that pick theme or meta decks** (gym, meta-decks, awards and similar) must give their profile
   `ownedDecks`, not weaken the rule. Task 4's sweep step pins it.

---

### Task 1: Deck prices in `@ptcg/economy`

**Files:**
- Modify: `packages/economy/src/config.ts`
- Test: `packages/economy/test/deck-prices.test.ts`

**Interfaces:**
- Produces: `CREDITS.deckPrices: { starter: 300; theme: 600; meta: 1200 }`;
  `export type PremadeKind = 'starter' | 'theme' | 'meta'`; `export function deckPrice(kind: PremadeKind): number`.

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from 'vitest';
import { CREDITS, deckPrice } from '../src/index.ts';

test('premade decks cost 300 (starter), 600 (theme) and 1,200 (meta)', () => {
  expect(deckPrice('starter')).toBe(300);
  expect(deckPrice('theme')).toBe(600);
  expect(deckPrice('meta')).toBe(1200);
  expect(CREDITS.deckPrices).toEqual({ starter: 300, theme: 600, meta: 1200 });
});
```

- [ ] **Step 2: Run it.** `pnpm --filter @ptcg/economy exec vitest run test/deck-prices.test.ts`. Expected: FAIL, because `deckPrice` is not exported.
- [ ] **Step 3: Implement** `deckPrices` in `CREDITS` and `deckPrice(kind)` in `config.ts`.
- [ ] **Step 4: Run it.** Expected: PASS.
- [ ] **Step 5: Commit.** Message: "Deck prices: starter 300, theme 600, meta 1,200".

---

### Task 2: Owned decks in the save (pure rules + upgrade)

**Files:**
- Create: `apps/web/src/profile/ownedDecks.ts`
- Modify: `apps/web/src/profile/types.ts` (`Profile.ownedDecks`, `newProfile`, `normalizeProfile`)
- Test: `apps/web/test/owned-decks.test.ts`

**Interfaces:**
- Consumes: `DECKS`, `deckById`, `type DeckId` from `src/game/catalog.ts`; `deckPrice` (Task 1).
- Produces (in `ownedDecks.ts`):
  - `FALLBACK_STARTER: DeckId = 'mega-gengar'`
  - `isPremadeDeck(id: string): id is DeckId`
  - `grantDeck(p: Profile, id: DeckId): Profile`: adds `id` to `ownedDecks` and its list's cards to `collection`.
    Returns `p` unchanged if the deck is already owned.
  - `upgradeOwnedDecks(p: Profile): Profile`:
    - Drops unknown ids and duplicates from `ownedDecks`.
    - If `introDone` and nothing is owned, grants `starterDeck` when it's a premade starter, otherwise `FALLBACK_STARTER`.
  - `purchaseProblem(p: Profile, id: string): string | null` returns:
    - `'Unknown deck'` for an id that isn't a premade deck
    - `'Decks are not sold in Collector mode'` in Collector mode
    - `'Already owned'` if the player owns it
    - `'Not enough credits'` if they can't afford it
    - `null` if the purchase is allowed
- `Profile` gains `ownedDecks: string[]`. `newProfile()` sets `[]`. `normalizeProfile` reads the raw array (or `[]`),
  then returns `upgradeOwnedDecks(...)` of the normalized profile.

- [ ] **Step 1: Write the failing tests** in `owned-decks.test.ts`:
  - `'a new profile owns nothing'`:
    `normalizeProfile(newProfile()).ownedDecks` equals `[]`, and the collection equals `{}`.
  - `'an old save with a finished intro owns its starter and gets its 60 cards'`:
    - Input: raw `{ version: 1, introDone: true, starterDeck: 'mega-diancie', collection: { 'me01-001': 2 } }` with no `ownedDecks`.
    - `ownedDecks` equals `['mega-diancie']`.
    - The collection's total count equals 62.
    - Every card in `deckById('mega-diancie').list.cards` has at least its count in the collection.
  - `'the starter is granted once: normalizing again changes nothing'`:
    `normalizeProfile(normalizeProfile(raw))` deep-equals `normalizeProfile(raw)`.
  - `'a finished intro with no or an unknown starter owns Mega Gengar'`:
    - `starterDeck: null` → `['mega-gengar']`.
    - `starterDeck: 'nope'` → `['mega-gengar']`.
  - `'an unfinished intro owns nothing'`: `introDone: false` → `[]`.
  - `'unknown and duplicate owned ids are dropped'`: `['mega-gengar', 'gone', 'mega-gengar']` → `['mega-gengar']`.
  - `'grantDeck adds the deck and its cards; granting again changes nothing'`.
  - `'purchaseProblem'`: one assertion for each of the 5 return values above, using `CREDITS.deckPrices.theme`
    credits for `'theme-…'`. Use the first theme deck id from `DECKS`.
- [ ] **Step 2: Run them.** `pnpm --filter ./apps/web exec vitest run test/owned-decks.test.ts`. Expected: FAIL, because the module is missing.
- [ ] **Step 3: Implement** `ownedDecks.ts` and the `types.ts` changes. Don't create an import cycle: `ownedDecks.ts` imports the `Profile` type only.
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Run the whole web suite once.** `pnpm --filter ./apps/web exec vitest run`. Fix any test that asserts an exact collection or profile shape after `init` by including the granted starter cards in its expectation. Note each fix in the commit message.
- [ ] **Step 6: Commit.** Message: "Saves own their starter deck: upgrade grants it once, with its cards".

---

### Task 3: Profile actions: intro grant and `buyDeck`

**Files:**
- Modify: `apps/web/src/profile/useProfile.ts` (`finishIntro`, new `buyDeck`)
- Test: `apps/web/test/profile-decks.test.ts`

**Interfaces:**
- Consumes: `grantDeck`, `purchaseProblem`, `FALLBACK_STARTER`, `isPremadeDeck` (Task 2); `deckPrice` (Task 1);
  `deckById` (catalog).
- Produces:
  - `buyDeck(id: string): Promise<void>`. It throws `new Error(purchaseProblem(...))` when the purchase isn't allowed.
    Otherwise it takes the price and grants the deck in one `change`.
  - `finishIntro(name, deck)` also grants the chosen starter (or `FALLBACK_STARTER`).

- [ ] **Step 1: Write the failing tests.** Use `createMemoryStore` + `useProfile.getState().init(store, true)`, as `profile.test.ts` does.
  - `'finishing the intro owns the chosen starter and adds its cards'`:
    - `finishIntro('ASH', 'mega-lucario')`.
    - `ownedDecks` equals `['mega-lucario']`.
    - The collection holds the deck's cards.
  - `'skipping the deck choice owns Mega Gengar'`: `finishIntro('ASH', undefined)`.
  - `'buying a theme deck takes 600 credits, owns it and adds its 60 cards'`:
    - Start with 1,000 credits and the intro done.
    - Credits afterwards: 400.
    - `ownedDecks` contains the id.
    - The collection total grows by 60.
    - The result is saved: reload from the same store and the deck is still owned.
  - `'buying the same deck twice fails and charges once'`:
    - The second `buyDeck` rejects with `'Already owned'`.
    - Credits are unchanged after the second call.
  - `'buying without enough credits fails and changes nothing'`.
  - `'Collector mode does not sell decks'`.
- [ ] **Step 2: Run them.** `pnpm --filter ./apps/web exec vitest run test/profile-decks.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `buyDeck` next to `buyPack`, and extend `finishIntro`.
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Commit.** Message: "Buy premade decks with credits; the intro grants the starter".

---

### Task 4: Duel and Gym offer only owned decks

**Files:**
- Modify: `apps/web/src/game/catalog.ts` (`ownedDeckSources`), `apps/web/src/screens/DuelSetup.tsx`,
  `apps/web/src/screens/GymChallenge.tsx`
- Test: `apps/web/test/deck-ownership-screens.test.tsx`; sweep existing tests.

**Interfaces:**
- Produces: `ownedDeckSources(owned: readonly string[], custom: readonly {id; name; cards}[]): DeckSource[]`.
  It returns the owned premade decks in `DECKS` order, then the custom decks, in the same shape as `deckSources`.
- Behaviour:
  - **DuelSetup:**
    - "Your deck" uses `ownedDeckSources(ownedDecks, validCustom)`.
    - The default selection is `starterDeck` if it's in that list, otherwise the list's first deck.
    - Hotseat player 2 chooses from `deckSources([])` (every premade deck).
    - `botPool` becomes every `DECKS` entry. It must not be built from the player's list.
  - **GymChallenge:** the picker uses `ownedDeckSources(ownedDecks, gymValidCustom)`. The locked Elite run deck path
    stays as it is.

- [ ] **Step 1: Write the failing tests.**
  - `'Duel lists only owned premade decks and valid custom decks'`:
    - Profile: intro done, `ownedDecks: ['mega-gengar']`.
    - The "Your deck" group shows Mega Gengar and does not show Mega Diancie.
  - `'hotseat player 2 can pick any premade deck'`.
  - `'bots still play every premade deck'`:
    - Owning only Mega Gengar, start a Duel against Easy with `Math.random` stubbed to pick the last `DECKS` entry.
    - `useGame.getState().config` shows the bot's deck as that last deck.
  - `'the default deck falls back to the first owned deck when the saved starter is not owned'`:
    - `starterDeck: 'mega-lucario'`, `ownedDecks: ['mega-diancie']`.
    - Mega Diancie is selected.
  - `'Gym match setup lists only owned decks'`.
  - `'an Elite Four run in progress keeps its locked deck even if it is not owned'`:
    - `gym.run.deck` is a copy of a theme deck.
    - The setup shows that deck locked, and Battle starts the match with it.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement** `ownedDeckSources` and the two screens.
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Sweep.** Run the whole web suite. For each test that picks an unowned premade deck, add `ownedDecks` listing
  the decks it uses to that test's profile. Don't change the rule.
- [ ] **Step 6: Commit.** Message: "Duel and Gym offer owned decks; bots and hotseat keep every deck".

---

### Task 5: The Poké Mart Decks tab

**Files:**
- Create: `apps/web/src/ui/shop/DeckShop.tsx`
- Modify: `apps/web/src/screens/Shop.tsx` (Packs/Decks tabs), `apps/web/src/ui/frontier/RunDeckView.tsx`
  (optional `label` prop, default `'Run deck'`)
- Test: `apps/web/test/deck-shop.test.tsx`; `e2e/deck-shop.spec.ts`

**Interfaces:**
- Consumes: `buyDeck` (Task 3), `deckPrice` (Task 1), `DECKS`, `Sheet`, `RunDeckView`.
- UI contract (tests rely on these names):
  - **Tabs:** a `tablist` named "Shop sections", with tabs "Packs" and "Decks". Packs is selected by default. Collector mode hides the tablist.
  - **Deck groups:** the Decks tab has one section each, `region` named "Starter decks", "Theme decks" and "Meta decks".
  - **Deck entries:** each deck is a button named "View <deck name>". Its text shows the energy type and either
    "<price> credits" or "OWNED".
  - **Deck sheet:** a `Sheet` titled with the deck name. It contains `RunDeckView` labelled "Deck list". It shows
    "Buy for <price> credits" when the player can buy the deck, disabled and reading "Not enough credits" when they
    can't afford it, and no buy button once the deck is owned.
  - **After a purchase:** the sheet shows the status text "Added to your decks. 60 cards added to your binder.".
  - **Errors:** a failed purchase shows its error message in the sheet.

- [ ] **Step 1: Write the failing tests** in `deck-shop.test.tsx`:
  - `'the Decks tab lists 15 decks in three groups, with prices and OWNED on the starter'`.
  - `'a deck shows its full 60-card list'`. The sum of the `deck-count` test ids in "Deck list" is 60.
  - `'buying a theme deck charges 600, marks it OWNED and adds its cards'`.
  - `'the buy button reads Not enough credits and is disabled below the price'`.
  - `'Collector mode has no Decks tab'`.
  - `'a second press while buying does not charge twice'`: two quick clicks, then credits fall by exactly 600.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement** the `RunDeckView` label prop, `DeckShop`, and the tabs in `Shop.tsx`. Keep the Packs tab's
  content and tests unchanged.
- [ ] **Step 4: Run the unit tests and the existing `shop*.test.tsx`.** Expected: PASS.
- [ ] **Step 5: Write `e2e/deck-shop.spec.ts`:**
  - **Setup:** reach the menu with the town helpers from `e2e/town.spec.ts`, then raise credits through `?e2e` and `__profile`.
  - **At 390×844 and 1400×900, check:**
    1. Open Poké Mart.
    2. Open Decks.
    3. There is no sideways scroll.
    4. Buy the first theme deck.
    5. "OWNED" shows.
  - **Then:** go to Duel and assert that deck is listed under "Your deck".
  - **Run:**
    1. `pkill -f "[v]ite preview"`
    2. `PW_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npx playwright test e2e/deck-shop.spec.ts e2e/smoke.spec.ts`
  - **Expected:** all pass.
- [ ] **Step 6: Commit.** Message: "Poké Mart Decks tab: buy premade decks and see their card lists".

---

### Final

- [ ] Run `pnpm check` (root) and the full Playwright suite. Expected: all green.
- [ ] Fresh-context whole-branch review on the most capable model. Fix Critical/Important findings with TDD.
- [ ] PR → CI green → merge → reset the branch → verify the Vercel production deploy is READY.
