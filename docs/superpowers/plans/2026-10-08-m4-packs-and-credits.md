# M4 — Packs, Credits, Binder and Deck Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**

- Winning (or losing) against bots earns credits.
- Credits buy and open booster packs of Mega Evolution and Phantasmal Flames.
- Opened cards go into a binder.
- Owned, playable cards can be built into custom decks, which can be played like the starter decks.

**Architecture:**

- **Card data:** `packages/cards` imports the full card lists of the two sets, and marks each card `playable` when the engine can run it (it has a script, or it has no rules text).
- **`packages/economy`** (new, pure TS):
  - credit rules;
  - pack definitions and `openPack(rng)`;
  - custom-deck validation.
- **Profile storage:** credits, collection and custom decks live behind a `ProfileStore` interface. It is IndexedDB in the browser, with an in-memory fallback and in tests. A future accounts milestone swaps in a server implementation.
- **`apps/web`:** gains Shop, Binder and Deck Builder screens and awards credits when a bot game ends.

**Tech Stack:** as before. Plus `fake-indexeddb` (dev only) to test the IndexedDB store.

**Spec:** `docs/superpowers/specs/2026-10-08-pokemon-tcg-browser-game-design.md` §4.4 (economy, binder, deck builder, ProfileStore) and §5 (storage unavailable).

## Global Constraints

- **Credit values** (spec §4.4) live in one config file:
  - a new profile starts with 500;
  - a win pays 100 vs Easy and 200 vs Medium;
  - a loss pays 30 vs Easy and 50 vs Medium;
  - conceding gives nothing, and so do hotseat games;
  - each game awards at most once, keyed by its seed.
- **Pack:** costs 150 credits. Shop sets: `me01` Mega Evolution, `me02` Phantasmal Flames. Each pack has 10 cards:
  - slots 1–4: Common;
  - slots 5–7: Uncommon;
  - slot 8: reverse-holo — any Common, Uncommon or Rare (uniform);
  - slot 9: reverse-holo — 12% Illustration rare, else as slot 8;
  - slot 10 (rare or better): Rare 70%, Double rare 18%, Ultra Rare 7%, Special illustration rare 3%, Mega Hyper Rare 2%.
  - These rates are approximations, not official. A rarity tier with no cards in the set falls back to Rare.
- **Custom deck rules:**
  - exactly 60 cards;
  - at most 4 cards with the same name, except Basic Energy;
  - at least 1 Basic Pokémon;
  - at most 1 ACE SPEC;
  - every card has regulation mark H or later, except Basic Energy (no mark);
  - every non-Basic-Energy card must be playable and owned in at least that quantity.
  - Basic Energy is free and unlimited, and starter decks are always available.
- **Playable:** a card the engine can run correctly. That is:
  - a Pokémon whose attacks are either scripted or have no effect text, and whose Abilities are scripted;
  - a Trainer or Special Energy with a script;
  - any Basic Energy.
- **Storage failure:** if IndexedDB is unavailable (e.g. private browsing), the app uses an in-memory profile and shows a one-line warning that progress won't be saved.

## Review Focus

1. **Double awards:** the game-over screen re-renders, the page reloads, or the player clicks "Play again". Expected: each game awards credits exactly once (keyed by seed), and a concede by the human awards nothing.
2. **Insufficient credits:** buying a pack without enough credits is impossible; the button is disabled and the store refuses too. Credits never go negative.
3. **Partial pack opening:** the tab is closed or reloaded mid-reveal. Expected: the cards are already in the collection, because the collection and credits are saved before the reveal animation starts.
4. **Deck builder edge cases:**

- an owned card that is not playable cannot be added;
- removing cards from the collection is impossible (there is no selling), so saved decks stay valid;
- a deck using 4 copies of a card you own 3 of is rejected.

5. **Custom decks with bots:** the Medium bot receives the actual custom decklists, not just deck ids, so its guesses stay consistent.

---

### Task 1: Full set data and the `playable` flag

**Files:**

- `packages/cards/src/sets.json` (`["me01","me02"]`)
- `scripts/import-cards.ts` (also imports every card of the listed sets)
- `src/data/cards.json` (regenerated)
- `src/playable.ts`: `isPlayable(def: CardDef, registry: CardRegistry): boolean`
- `src/sets.ts`: `setCards(setId): CardDef[]`, plus `SETS: { id; name; logo }[]`
- tests in `test/playable.test.ts`

- [ ] **Step 1: Failing tests.**
  - me02-054 Gastly (no effect text) is playable.
  - me02-056 Mega Gengar ex (scripted) is playable.
  - A Pokémon with an unscripted Ability is not playable.
  - An unscripted Trainer is not playable.
  - Basic Energy is playable.
  - `setCards('me02')` has 130 cards, and every card id starts with `me02-`.
  - All starter-deck cards are playable.
- [ ] **Step 2–4:** FAIL → import the full sets and implement → PASS. **Step 5:** Commit `feat(cards): full Mega Evolution / Phantasmal Flames data and playable flag`.

### Task 2: Economy package — credits and packs

**Files:** `packages/economy/{package.json,tsconfig.json,vitest.config.ts}`, `src/{config.ts,packs.ts,index.ts}`, `test/packs.test.ts`

**Interfaces:**

- `CREDITS = { start: 500, packPrice: 150, win: { easy: 100, medium: 200 }, loss: { easy: 30, medium: 50 } }`.
- `creditsFor(result: GameResult, humanSeat: PlayerId, difficulty): number` returns 0 when the human conceded.
- `PACKS: { setId; name; price }[]`.
- `openPack(setId, cards: CardDef[], rng: number): { cards: string[]; rng: number }` returns 10 def ids using the slot rules from Global Constraints.

- [ ] **Step 1: Failing tests.**
  - A pack has 10 cards from its set.
  - Slots 1–4 are Common and slots 5–7 are Uncommon.
  - Over 20,000 seeded packs, the slot-10 rarity frequencies are within ±1.5 percentage points of the configured rates.
  - Slot 9's Illustration rare rate is 12% ±1.
  - The same rng gives the same pack.
  - `creditsFor` follows the table, and a concede gives 0.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat(economy): credit rules and booster packs`.

### Task 3: Custom deck validation

**Files:** `packages/economy/src/decks.ts`, `test/decks.test.ts`

**Interfaces:** `validateCustomDeck(deck: DeckList, registry: CardRegistry, collection: Record<string, number>): string[]` returns readable problems, and `[]` means the deck is valid.

- [ ] **Step 1: Failing tests,** one per rule in Global Constraints, each with its expected message:
  - "Deck has 59 cards (needs 60)"
  - "More than 4 Ultra Ball"
  - "No Basic Pokémon"
  - "More than 1 ACE SPEC"
  - "Arven (G) is not legal in Standard"
  - "X isn't playable yet"
  - "You own 3 Nest Ball but the deck uses 4"
  - Also: Basic Energy is unlimited and needs no owning, and the "4 per name" rule counts reprints with the same name together.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat(economy): custom deck validation`.

### Task 4: Profile store and credit awards

**Files:** `apps/web/src/profile/{types.ts,memoryStore.ts,indexedDbStore.ts,useProfile.ts}`, `apps/web/src/game/awards.ts`, tests `apps/web/test/profile.test.ts` (with `fake-indexeddb/auto`)

**Interfaces:**

- `Profile = { version: 1; credits: number; collection: Record<string, number>; decks: CustomDeck[]; awardedGames: number[] }`
- `CustomDeck = { id: string; name: string; cards: { id: string; count: number }[] }`
- `ProfileStore = { load(): Promise<Profile>; save(p: Profile): Promise<void> }`
- `useProfile` (Zustand) offers:
  - `profile`, `persistent: boolean`
  - `init(store)`
  - `award(seed, amount)` — idempotent per seed; `awardedGames` keeps the last 200 seeds
  - `buyPack(setId): Promise<string[]>` — checks credits, opens the pack, adds the cards and saves _before_ returning (RF3)
  - `saveDeck(deck)`, `deleteDeck(id)`
- `awards.ts`: when a bot game reaches a result, call `award(seed, creditsFor(...))` once.

- [ ] **Step 1: Failing tests.**
  - A new profile has 500 credits.
  - The IndexedDB store round-trips a profile.
  - If opening IndexedDB throws, the app falls back to the memory store with `persistent: false`.
  - **(RF1)** `award` with the same seed twice adds once.
  - **(RF2)** `buyPack` with 100 credits rejects and leaves the profile unchanged.
  - `buyPack` subtracts 150 and adds 10 cards to the collection before resolving.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat(web): profile storage and credit awards`.

### Task 5: Shop and pack opening

**Files:** `apps/web/src/screens/Shop.tsx`, `src/ui/PackOpening.tsx`, `App.tsx` navigation (Home / Shop / Binder / Decks), test `apps/web/test/shop.test.tsx`

- [ ] **Step 1: Failing tests.**
  - The Shop shows the credit balance and both packs with a 150 price.
  - **(RF2)** "Buy & open" is disabled below 150.
  - Buying shows the 10 cards one at a time ("Next", "Reveal all"), and the balance drops by 150.
  - The game-over overlay shows "+N credits" for a bot game.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat(web): shop and pack opening`.

### Task 6: Binder

**Files:** `apps/web/src/screens/Binder.tsx`, test `apps/web/test/binder.test.tsx`

- [ ] **Step 1: Failing tests.**
  - The Binder lists a set's cards in number order.
  - Owned cards show their count, and unowned cards are greyed out.
  - Playable cards show a "Playable" badge.
  - The filters "Owned only" and "Playable only" work.
  - Clicking a card opens Card details.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat(web): binder`.

### Task 7: Deck builder and custom decks in play

**Files:**

- `apps/web/src/screens/DeckBuilder.tsx`
- `src/game/catalog.ts` (deck sources: starter decks plus custom decks from the profile)
- `store.ts` (`GameConfig` carries the actual decklists)
- `botClient.ts` (`BotSetup.decks` becomes the decklists, RF5)
- `Home.tsx` (the deck picker includes custom decks)
- test `apps/web/test/builder.test.tsx`

- [ ] **Step 1: Failing tests.**
  - The builder adds and removes cards, showing a live count and the validation messages from `validateCustomDeck`.
  - Save is disabled while the deck is invalid.
  - **(RF4)** Adding a 4th copy of a card owned 3 times is blocked, and non-playable owned cards can't be added.
  - A saved deck appears in Home's deck picker and starts a game.
  - **(RF5)** A Medium bot game with a custom deck sends the custom decklist in `BotSetup`.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat(web): deck builder and custom decks`.

### Task 8: Ship

- [ ] Playwright smoke test: start → Shop → buy a pack → reveal all → Binder shows the new cards.
- [ ] Whole-branch review → fix pass (test-first) → PR → CI green → merge → check the Vercel production deployment.
