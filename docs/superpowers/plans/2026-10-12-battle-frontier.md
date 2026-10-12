# Battle Frontier Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A single-player roguelike: draft a 60-card deck through 8 escalating bot fights with 2 lives, saved in the
profile, with a Hall of Fame and end-of-run rewards.

**Architecture:** Pure rules modules in `apps/web/src/game/frontier/` (pool, offers, opponents, run state machine, deck
legality) with no React or saving. The profile store gains a `frontier` field and actions that call those modules.
Screens and match wiring come last and only call the store.

**Tech Stack:** TypeScript, React 19, Zustand, Tailwind 4, vitest, Playwright, `@ptcg/economy` (deck validator),
`@ptcg/bots` (Easy, Medium, Hard).

**Spec:** `docs/superpowers/specs/2026-10-11-battle-frontier-design.md`

## Global Constraints

- 8 fights, 2 lives. Difficulty bands: fights 1–3 Easy, 4–6 Medium, 7–8 Hard (fight 8 is the boss).
- Run deck: always exactly 60 cards; at most 4 copies per card name except basic Energy; at most 1 ACE SPEC; at least
  1 Basic Pokémon; every card passes `isGymUsable` (Standard-legal or Scarlet & Violet 151, and playable).
- Offers: exactly 3 per win after fights 1–7; a **Tune-up** is one of the 3 after fights 2, 4 and 6 (0-based fight
  index 1, 3, 5). Tier odds by the fight just won: 1–2 → plain 80 / ex 20 / ACE 0; 3–5 → 55 / 40 / 5; 6–7 → 35 / 55 / 10.
- Packages are 2–4 cards, except an ACE SPEC package (1 card). After taking a package of N cards the player cuts N.
- Credits per fight won: Easy 60, Medium 120, Hard 200; boss bonus 300; a full clear pays 1,240. Normal per-game bot
  credits are never paid for Frontier fights.
- Keep-1-card: any card of the final run deck except basic Energy; the player can decline.
- Hall of Fame: cleared runs only, newest first, at most 20. Frontier Brains are original characters (names below).
- Randomness is a pure function of the run seed and the fight number; each match's shuffle seed is fresh.
- Leaving a fight mid-match (quit or reload) counts as a loss. Collector mode hides the Frontier.
- UI: existing retro components, 16px gutters at phone width, no horizontal scroll, light and dark mode.
- `pnpm check` before every push. Commits end with the session's attribution trailers.
- **Ruling (spec location):** the spec says the bot simulation lives in `packages/bots`, but the Frontier modules live
  in `apps/web` (which `packages/bots` can't import), so the simulation test lives in `apps/web/test`. Same intent.

## Review Focus

1. **A reload during a fight** (profile saved with `inMatch`) is a loss on next load, not a stuck run. Task 5.
2. **Two result events for one game seed** (double render, second tab) pay and cost a life only once. Task 5.
3. **An offer that can't be taken legally** (for example a 3rd copy of an ACE SPEC, or a 5th copy of a name) is never
   shown, and every shown offer has a legal cut. Task 2.
4. **A broken or old save** (`frontier` missing, a half-written run) loads as "no run", never crashes the app. Task 5.
5. **Opponent pool exhaustion:** meta decks are shared between the Medium and Hard bands, and no deck repeats in a run.
   Task 3.

---

## PR 1 — Rules, profile and simulation

### Task 1: Package pool

**Files:**
- Create: `apps/web/src/game/frontier/pool.ts`
- Test: `apps/web/test/frontier-pool.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Tier = 'plain' | 'ex' | 'ace';
  export interface FrontierPackage {
    id: string;                      // stable: sorted "cardId*count" joined by "+"
    kind: 'line' | 'trainers' | 'energy';
    tier: Tier;
    cards: { id: string; count: number }[];
  }
  export function buildPool(decks: readonly DeckList[], registry: CardRegistry): FrontierPackage[];
  export const frontierPool: () => FrontierPackage[]; // buildPool over catalog DECKS + GYM_DECKS, cached
  ```

- [ ] **Step 1: Write the failing tests** in `frontier-pool.test.ts`, using a small hand-built registry
  (`miniRegistry` from `@ptcg/engine/testing`) and the real catalog:
  - `a Stage 1 line includes the Basic it evolves from, in the counts the deck uses (Basic ≤ 2, Stage 1 ≤ 2)`
  - `a Stage 2 line is 2-1-1 or 1-1-1 and includes both earlier stages`
  - `a Basic that does not evolve in its deck is a 2-copy package, and skipped if the deck has only 1`
  - `Trainers are 2-copy packages; an ACE SPEC is a 1-card package with tier "ace"`
  - `Special Energy is a 2-copy package; basic Energy is never offered`
  - `a package with an ex or Mega Pokémon has tier "ex"`
  - `packages with the same cards from different decks appear once`
  - `real catalog: every package card passes isGymUsable, every package has 2-4 cards (ACE: 1), and the pool has at least 40 packages`
- [ ] **Step 2: Run them.** Run: `pnpm --filter @ptcg/web exec vitest run test/frontier-pool.test.ts`
  Expected: FAIL (module not found).
- [ ] **Step 3: Implement `buildPool` and `frontierPool`.** For each deck: group Pokémon into chains by following
  `evolvesFrom` (a Pokémon name) to a card with that name in the same deck. A chain's counts are
  `[min(basic,2), min(stage1, stage2 ? 1 : 2), min(stage2,1)]`. Drop packages with any card failing
  `isGymUsable(def, registry)` (from `@ptcg/economy`).
- [ ] **Step 4: Run them again.** Expected: PASS.
- [ ] **Step 5: Commit** ("Frontier: package pool").

### Task 2: Run-deck legality and offers

**Files:**
- Create: `apps/web/src/game/frontier/deck.ts`, `apps/web/src/game/frontier/offers.ts`
- Test: `apps/web/test/frontier-offers.test.ts`

**Interfaces:**
- Consumes: Task 1's `FrontierPackage`, `frontierPool`.
- Produces:
  ```ts
  // deck.ts
  export type RunCards = { id: string; count: number }[];
  export const runDeckProblems = (cards: RunCards, registry: CardRegistry): string[]; // [] = legal
  export function applyChange(cards: RunCards, add: RunCards, cut: RunCards): RunCards; // merges, drops zero counts
  export function autoCut(cards: RunCards, add: RunCards, n: number, registry: CardRegistry): RunCards | null;
  // offers.ts
  export type Offer = { kind: 'package'; pkg: FrontierPackage } | { kind: 'tuneup' };
  export const hasTuneup: (fightJustWon: number) => boolean;           // fights 1, 3, 5 (0-based)
  export function offersFor(o: { seed: number; fight: number; deck: RunCards }, pool: FrontierPackage[], registry: CardRegistry): Offer[];
  ```

- [ ] **Step 1: Write the failing tests:**
  - `runDeckProblems accepts a built-in starter deck and reports a 61-card deck, a 5th copy, a 2nd ACE SPEC and no Basic`
  - `applyChange adds, cuts, and removes cards that reach zero`
  - `autoCut finds a legal cut for a package that pushes a name past 4 copies, and returns null when none exists`
  - `offersFor returns exactly 3 offers after every fight 0..6 for 200 seeds across every starter deck as the run deck`
  - `every package offer has an autoCut, so it can always be taken legally` (Review Focus 3)
  - `a Tune-up is among the 3 only after fights index 1, 3 and 5`
  - `the 3 offers are different from each other`
  - `same seed, fight and deck give the same offers`
  - `tier odds follow the table (over 3000 draws per band, within 4 points)`
- [ ] **Step 2: Run them.** Expected: FAIL (modules not found).
- [ ] **Step 3: Implement.** `runDeckProblems` wraps `validateGymDeck` with a collection that has 99 of everything
  (`new Proxy({}, { get: () => 99 })`). `autoCut` removes N cards preferring (1) copies causing a violation,
  (2) basic Energy, (3) Trainers with the highest count, (4) non-Basic Pokémon; never the last Basic Pokémon; returns
  `null` unless the result passes `runDeckProblems`. `offersFor` draws from `nextRandom` seeded by
  `(seed ^ (fight + 1) * 0x9e3779b1) >>> 0`: pick a tier by the band's odds, then a package of that tier that has an
  `autoCut`; fall back to a lower tier if none.
- [ ] **Step 4: Run them again.** Expected: PASS.
- [ ] **Step 5: Commit** ("Frontier: run-deck legality and offers").

### Task 3: Opponents and Frontier Brains

**Files:**
- Create: `apps/web/src/game/frontier/opponents.ts`
- Test: `apps/web/test/frontier-opponents.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface FrontierOpponent {
    source: 'catalog' | 'gym'; id: string;   // DeckId or GymDeckId
    name: string; cover: string;
    difficulty: 'easy' | 'medium' | 'hard';
    brain?: string;                           // set on the boss only
  }
  export const FRONTIER_BRAINS: Record<string, { name: string; intro: string; win: string; lose: string }>; // key: meta DeckId
  export function drawOpponents(seed: number, starterId: string): FrontierOpponent[];   // 8
  export function opponentDeck(o: FrontierOpponent): DeckList;
  ```
  Brain names: dragapult "Vesper", alakazam "Quill", ogerpon-box "Thorne", ns-zoroark "Nox", slowking "Brine",
  crustle "Granite". Each has an `intro`, `win` and `lose` line in the tone of the Gym Leaders.

- [ ] **Step 1: Write the failing tests:**
  - `draws 8 opponents: difficulties easy x3, medium x3, hard x2`
  - `no deck repeats in a run, and none is the starter the player picked` (200 seeds × every starter, Review Focus 5)
  - `fights 7 and 8 are meta decks; fights 1-3 are starter or theme decks; fights 4-6 are theme, Gym Leader or meta decks`
  - `the boss carries a brain whose key matches its meta deck`
  - `same seed gives the same opponents`
  - `opponentDeck resolves every drawn opponent to a 60-card deck`
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.** Draw the hard band first (2 distinct meta decks), then medium from theme + the 8 Gym
  Leader decks (`LEADERS` ids) + remaining meta, then easy from starters + themes, each removing used ids.
- [ ] **Step 4: Run them again.** Expected: PASS.
- [ ] **Step 5: Commit** ("Frontier: opponents and Frontier Brains").

### Task 4: Run state machine

**Files:**
- Create: `apps/web/src/game/frontier/run.ts`
- Test: `apps/web/test/frontier-run.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces:
  ```ts
  export interface FrontierRun {
    seed: number;
    phase: 'starter' | 'hub' | 'reward' | 'over';
    starterChoices: string[];            // 3 starter DeckIds
    starterId: string | null;
    fight: number;                       // 0..7, next or current fight
    lives: number;                       // 2..0
    wins: number;                        // fights won
    deck: RunCards; cover: string;
    opponents: FrontierOpponent[];
    offers: Offer[] | null;
    inMatch?: boolean;
    cleared?: boolean;
  }
  export function newRun(seed: number): FrontierRun;                       // phase 'starter'
  export function chooseStarter(r: FrontierRun, id: string): FrontierRun;  // -> 'hub'
  export function beginFight(r: FrontierRun): FrontierRun;                 // sets inMatch
  export function recordResult(r: FrontierRun, outcome: 'win' | 'loss' | 'draw'): FrontierRun;
  export function takeOffer(r: FrontierRun, index: number, cut: RunCards, energy?: { id: string; count: number }[]): FrontierRun;
  export function skipOffer(r: FrontierRun): FrontierRun;
  export function abandon(r: FrontierRun): FrontierRun;                    // -> 'over', not cleared
  export const payout: (r: FrontierRun) => number;                         // credits
  export const keepableCards: (r: FrontierRun) => string[];                // card ids, no basic Energy
  ```
  Invalid calls (wrong phase, wrong cut size, illegal resulting deck) throw `Error`.

- [ ] **Step 1: Write the failing tests:**
  - `newRun offers 3 different starter decks and is deterministic per seed`
  - `choosing a starter makes it the run deck, draws 8 opponents and enters the hub`
  - `a win on fights 1-7 opens the reward phase with 3 offers; a win on fight 8 clears the run (phase over, cleared)`
  - `a loss costs a life and replays the same fight; the second loss ends the run`
  - `a draw replays the fight with no life lost`
  - `beginFight sets inMatch and recordResult clears it`
  - `takeOffer adds the package, cuts exactly N cards, keeps the deck legal and moves to the next fight`
  - `takeOffer throws for a wrong cut size, an illegal deck, and the wrong phase`
  - `a Tune-up replaces 0-3 cut cards with chosen basic Energy`
  - `skipOffer moves to the next fight with the deck unchanged`
  - `payout: Easy 60, Medium 120, Hard 200, boss +300; a full clear is 1240; fights not won pay nothing`
  - `abandon pays for fights already won` and `keepableCards excludes basic Energy`
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement** each function as a pure transformation (copy, never mutate). `cover` is the starter
  deck's cover card.
- [ ] **Step 4: Run them again.** Expected: PASS.
- [ ] **Step 5: Commit** ("Frontier: run state machine").

### Task 5: Profile integration

**Files:**
- Modify: `apps/web/src/profile/types.ts` (add `frontier`), `apps/web/src/profile/useProfile.ts` (actions)
- Create: `apps/web/src/game/frontier/save.ts` (`normalizeFrontier`, Hall of Fame helpers)
- Test: `apps/web/test/frontier-profile.test.ts`

**Interfaces:**
- Consumes: Task 4.
- Produces:
  ```ts
  export interface FrontierHallEntry { date: string; playerName: string; deckName: string; cover: string; livesLeft: number }
  export interface FrontierProgress { run: FrontierRun | null; hallOfFame: FrontierHallEntry[] }
  // Profile gains: frontier: FrontierProgress
  // useProfile gains:
  startFrontierRun(): Promise<void>;
  chooseFrontierStarter(id: string): Promise<void>;
  beginFrontierMatch(): Promise<void>;
  recordFrontier(o: { seed: number; won: boolean; draw: boolean }): Promise<{ counted: boolean } | undefined>;
  takeFrontierOffer(index: number, cut: RunCards, energy?: RunCards): Promise<void>;
  skipFrontierOffer(): Promise<void>;
  abandonFrontierRun(): Promise<void>;
  endFrontierRun(keepCardId: string | null): Promise<{ credits: number } | undefined>;
  settleUnfinishedFrontierMatch(): Promise<void>;   // inMatch run -> recorded as a loss
  ```

- [ ] **Step 1: Write the failing tests:**
  - `an old profile without frontier loads with no run and an empty Hall of Fame`
  - `a malformed run (wrong types, 3 lives, unknown phase) is dropped on load, not thrown` (Review Focus 4)
  - `startFrontierRun / chooseFrontierStarter / skip / take save through the store`
  - `recordFrontier counts a result once per game seed` (Review Focus 2) `and ignores a result when no match is in progress`
  - `settleUnfinishedFrontierMatch records a loss for a run saved with inMatch` (Review Focus 1)
  - `endFrontierRun pays the credits, adds the kept card to the collection, clears the run`
  - `a cleared run adds a Hall of Fame entry (newest first, capped at 20); a lost run does not`
  - `abandonFrontierRun ends the run and pays for fights won`
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.** Follow `recordElite` / `beginEliteMatch` in `useProfile.ts` for the `change(...)` queue and
  `awardedGames` seed bookkeeping. `normalizeProfile` calls `normalizeFrontier(raw.frontier)`.
- [ ] **Step 4: Run them again,** then `pnpm --filter @ptcg/web test`. Expected: PASS.
- [ ] **Step 5: Commit** ("Frontier: profile fields and actions").

### Task 6: Bot-simulated runs

**Files:**
- Test: `apps/web/test/frontier-sim.test.ts`

**Interfaces:**
- Consumes: Tasks 1–4, `runMatch`, `createEasyBot`, `createMediumBot`, `createHardBot` from `@ptcg/bots`.

- [ ] **Step 1: Write the test** `plays 12 seeded runs end to end with bots, random offers and cuts`: for seeds 1..12,
  `newRun`, `chooseStarter`, then loop: play the fight with the run deck (seat 0, Easy bot) against the opponent's
  deck piloted by the band's bot (Medium with 2 samples; Hard with `maxRounds: 1`, frozen clock), `recordResult`,
  and on reward pick a random offer with `autoCut`. After every step assert `runDeckProblems(run.deck)` is `[]`,
  and every match has `violations` equal to `[]`. Runs may end by clear or by two losses; assert at least one run
  reaches the reward phase.
- [ ] **Step 2: Run it.** Run: `pnpm --filter @ptcg/web exec vitest run test/frontier-sim.test.ts`
  Expected: PASS (nothing new to implement). Any violation is a real bug in Tasks 1–4: fix it under
  systematic-debugging with a unit test in that task's file.
- [ ] **Step 3: Run `pnpm check`. Open PR 1** ("Battle Frontier: rules and profile"), merge when CI is green and check
  the production deploy.

---

## PR 2 — Screens and match wiring

### Task 7: Match wiring

**Files:**
- Modify: `apps/web/src/game/store.ts` (`GameContext`), `apps/web/src/game/describe.ts` (`opponentName`),
  `apps/web/src/game/awards.ts` (`useGymResult`), `apps/web/src/App.tsx` (reset target), `apps/web/src/nav/useNav.ts`
- Create: `apps/web/src/game/frontierMatch.ts`
- Test: `apps/web/test/frontier-match.test.tsx`

**Interfaces:**
- Produces:
  - `GameContext` adds `{ kind: 'frontier'; fight: number; opponent: string }`.
  - `startFrontierMatch(): Promise<void>` — calls `beginFrontierMatch`, then `useGame.start` with the run deck, the
    opponent's deck, the band's difficulty, a fresh seed, and the context above.
  - `Route` adds `'frontier'`.

- [ ] **Step 1: Write the failing tests:**
  - `startFrontierMatch starts a bot game with the run deck, the opponent deck and the band's difficulty`
  - `opponentName returns the Frontier Brain's name for the boss and the deck name otherwise`
  - `a finished frontier game calls recordFrontier once with won / draw`
  - `quitting a frontier match counts as a loss (concede) and the result goes to recordFrontier`
  - `no normal Duel credits are paid for a frontier game`
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.** In `useGymResult`, add a `context.kind === 'frontier'` branch calling `recordFrontier`.
  In `App.tsx`, `reset` goes to `'frontier'` for a frontier context. Mount the Frontier game-over panel in Task 9.
- [ ] **Step 4: Run them again.** Expected: PASS.
- [ ] **Step 5: Commit** ("Frontier: match wiring").

### Task 8: Hub and starter pick screen

**Files:**
- Create: `apps/web/src/screens/BattleFrontier.tsx`, `apps/web/src/ui/frontier/FightTrack.tsx`,
  `apps/web/src/ui/frontier/OpponentCard.tsx`
- Modify: `apps/web/src/screens/MainMenu.tsx` (ITEMS: `{ id: 'frontier', label: 'Battle Frontier' }`),
  `apps/web/src/App.tsx` (`SCREENS`, hidden in Collector mode), `apps/web/src/nav/useNav.ts`
- Test: `apps/web/test/frontier-screen.test.tsx`

- [ ] **Step 1: Write the failing tests:**
  - `the main menu has Battle Frontier, and Collector mode hides it`
  - `with no run, the screen offers Start run; starting shows 3 starter deck tiles`
  - `picking a starter shows the hub: lives, the 1-8 fight track with a boss mark, the next opponent card, View deck, Fight, Abandon run`
  - `Abandon run asks to confirm`
  - `Fight starts the match (startFrontierMatch is called)`
  - `a run saved with inMatch is settled as a loss when the screen opens`
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement** the screen as a switch on `profile.frontier.run?.phase`; call
  `settleUnfinishedFrontierMatch` in an effect on mount (like `abandonUnfinishedRun` in `GymChallenge.tsx`).
  Opponent card shows the cover art (`art(cover)` as in `GymChallenge.tsx`), name, difficulty and, for the boss,
  the Brain's name.
- [ ] **Step 4: Run them again.** Expected: PASS.
- [ ] **Step 5: Commit** ("Frontier: hub and starter pick").

### Task 9: Reward, cut picker, end of run

**Files:**
- Create: `apps/web/src/ui/frontier/RewardPanel.tsx`, `apps/web/src/ui/frontier/CutPicker.tsx`,
  `apps/web/src/ui/frontier/RunEnd.tsx`, `apps/web/src/ui/FrontierGameOver.tsx`
- Modify: `apps/web/src/screens/BattleFrontier.tsx`, `apps/web/src/App.tsx` (render `FrontierGameOver` for a frontier
  context)
- Test: `apps/web/test/frontier-reward.test.tsx`

**Interfaces:**
- `CutPicker` props: `{ deck: RunCards; add: RunCards; count: number; energyChoices?: boolean; onConfirm(cut: RunCards, energy?: RunCards): void }`.
  Lists the merged deck grouped Pokémon / Trainers / Energy; Confirm is enabled only when exactly `count` cards are
  picked and `runDeckProblems` of the result is `[]`.

- [ ] **Step 1: Write the failing tests:**
  - `reward phase shows 3 offers with their cards, plus Skip`
  - `taking a package opens the cut picker; Confirm stays disabled until exactly N cards are picked and the deck is legal`
  - `a Tune-up lets the player cut 0-3 cards and pick a basic Energy type for each`
  - `Skip moves on without changing the deck`
  - `after a win the game-over panel says Continue and returns to the reward phase; after a loss it shows lives left and Retry the fight`
  - `the end-of-run screen shows fights won and credits, a keep-1-card picker (basic Energy not listed, decline allowed), then the Hall of Fame`
  - `a cleared run shows up in the Hall of Fame list`
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement** with existing retro components (`Box`, `Button`, `DialogBox`, `CardThumb`). Follow
  `GymGameOver.tsx` for the result dialog, and play `sfx` the same way.
- [ ] **Step 4: Run them again.** Expected: PASS.
- [ ] **Step 5: Commit** ("Frontier: rewards, cut picker, end of run").

### Task 10: End-to-end and ship

**Files:**
- Create: `apps/web/e2e/frontier.spec.ts`

- [ ] **Step 1: Write the Playwright test** `a run: start, pick a starter, win fight 1, take an offer, reload to fight 2`.
  It opens the app past the intro, goes to Battle Frontier, starts a run, picks the first starter, presses Fight,
  makes the bot concede with `window.__game.getState().dispatch(1, { type: 'concede' })`, presses Continue, takes
  the first offer (confirming a cut when asked), reloads the page, opens Battle Frontier again and expects the hub
  to show fight 2.
- [ ] **Step 2: Run it.** Kill any `vite preview` on port 4173, then:
  `PW_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome pnpm --filter @ptcg/web e2e`
  Expected: all tests pass, including the new one.
- [ ] **Step 3: Run `pnpm check`, check phone width** (390 px) for horizontal scroll on the hub, reward and cut picker
  screens in the Playwright test with `page.setViewportSize`.
- [ ] **Step 4: Open PR 2** ("Battle Frontier: screens"), merge when CI is green and verify the production deploy.
