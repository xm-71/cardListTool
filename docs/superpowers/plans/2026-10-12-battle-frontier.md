# Battle Frontier Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A single-player roguelike: draft a 60-card deck through 8 escalating bot fights with 2 lives, saved in the
profile, with a Hall of Fame and end-of-run rewards.

**Architecture:** Pure rules modules in `apps/web/src/game/frontier/` (pool, offers, opponents, run state machine, deck
rules) with no React or saving. The profile store gains a `frontier` field and actions that call those modules.
Screens and match wiring come last and only call the store.

**Tech Stack:** TypeScript, React 19, Zustand, Tailwind 4, vitest, Playwright, `@ptcg/economy` (deck rules),
`@ptcg/bots` (Easy, Medium, Hard).

**Spec:** `docs/superpowers/specs/2026-10-11-battle-frontier-design.md`

## Global Constraints

- 8 fights, 2 lives. Difficulty bands: fights 1–3 Easy, 4–6 Medium, 7–8 Hard (fight 8 is the boss).
- Run deck rules (the spec's, and only these): exactly 60 cards; at most 4 copies per card **name** except basic
  Energy; at most 1 ACE SPEC; at least 1 Basic Pokémon. Every card must pass `isPlayable`. Format legality (Standard or
  Gym) is **not** checked: 2 of the 3 starter decks use G-mark cards (Arven, Iono, Nest Ball, Professor's Research).
- Offers: exactly 3 per win after fights 1–7; a **Tune-up** is one of the 3 after fights 2, 4 and 6. In code,
  `fight` is always the **0-based index of the fight just won** (Tune-up at 1, 3, 5). Tier odds by that index:
  0–1 → plain 80 / ex 20 / ACE 0; 2–4 → 55 / 40 / 5; 5–6 → 35 / 55 / 10.
- Packages are 2–4 cards, except an ACE SPEC package (1 card). After taking a package of N cards the player cuts N.
- Tune-up adds basic Energy as the Mega Evolution Energy cards: Grass `mee-001`, Fire `mee-002`, Water `mee-003`,
  Lightning `mee-004`, Psychic `mee-005`, Fighting `mee-006`, Darkness `mee-007`, Metal `mee-008`.
- Credits per fight won: Easy 60, Medium 120, Hard 200; boss bonus 300; a full clear pays 1,240. Normal per-game bot
  credits are never paid for Frontier fights.
- Keep-1-card: any card of the final run deck except basic Energy; the player can decline.
- Hall of Fame: cleared runs only, newest first, at most 20. Frontier Brains are original characters (names below).
- Randomness is a pure function of the run seed and the fight number; each match's shuffle seed is fresh. Offers and
  opponents are stored in the run once drawn, so a reload can't reroll them.
- Leaving a fight mid-match (quit or reload) counts as a loss. Collector mode hides the Frontier.
- UI: existing retro components, 16px gutters at phone width, no horizontal scroll, light and dark mode.
- `pnpm check` before every push. Commits end with the session's attribution trailers.

**Rulings on spec gaps (decided here, reported in the PR):**
- *Offers that can't be kept whole are hidden.* Cutting the package itself is always legal, so the spec's "could break a
  deck rule even after the best possible cut" would filter nothing. An offer is shown only if some legal cut keeps
  **all** of its cards (so no 5th copy of a name and no 2nd ACE SPEC is ever offered).
- *Basic pairs.* A Basic Pokémon that doesn't evolve in its deck (e.g. Ogerpon Box) is offered as a 2-copy package of
  kind `'line'`; without it the pool would miss whole decks.
- *Unfinished matches are settled when the Frontier screen opens* (the Gym Challenge pattern), not on app load.
- *A finished run must be claimed* (`endFrontierRun`) before a new one can start; the screen shows the end-of-run
  view until then.

## Review Focus

1. **Every starter deck is a legal run deck,** and stays legal after any shown offer and any cut the picker allows.
   Tasks 2, 6.
2. **A reload during a fight** (profile saved with `inMatch`) is a loss when the Frontier opens, not a stuck run. Task 5.
3. **A result for one game seed or one fight counts once,** and a stale result for a fight the run has already left
   (second tab) is ignored. Task 5.
4. **A finished Frontier game never reaches the Gym game-over screen** (it reads `ELITE[stage]` and would crash).
   Task 7.
5. **The simulation actually reaches late fights** (ex and ACE tiers, Tune-ups) and finishes inside CI's time. Task 6.

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

**Rules:** per deck, one **line** package per top-stage Pokémon (a card no other Pokémon in that deck evolves from),
following `evolvesFrom` (a Pokémon name) to cards of that name in the same deck. Branches (Buneary → Lopunny and
Mega Lopunny ex; Haunter → Gengar and Mega Gengar ex) give one package each. Counts: 2-stage
`[min(basic,2), min(stage1,2)]`; 3-stage `[min(basic,2), 1, 1]`. A non-evolving Basic with ≥ 2 copies in its deck is a
2-copy line. **Trainers:** 2 copies if the deck has ≥ 2, skipped otherwise; an ACE SPEC is a 1-copy package (tier
`'ace'`). **Special Energy:** 2 copies if the deck has ≥ 2. Tier `'ex'` if any Pokémon is ex or Mega. Every card must
pass `isPlayable`; dedupe by `id`.

- [ ] **Step 1: Write the failing tests** (a hand-built registry via `miniRegistry`, plus the real catalog):
  - `a Stage 1 line includes the Basic it evolves from, in the counts the deck uses (Basic ≤ 2, Stage 1 ≤ 2)`
  - `a Stage 2 line is 2-1-1 or 1-1-1 and includes both earlier stages`
  - `a branching Basic gives one package per top-stage card`
  - `a non-evolving Basic is a 2-copy line, skipped if its deck has only 1`
  - `Trainers are 2-copy packages and 1-copy Trainers are skipped; an ACE SPEC is a 1-card "ace" package`
  - `Special Energy is a 2-copy package; basic Energy is never offered`
  - `a package with an ex or Mega Pokémon has tier "ex"`
  - `packages with the same cards from different decks appear once`
  - `real catalog: every card isPlayable, 2-4 cards per package (ACE: 1), at least 100 packages, at least 3 ACE packages`
- [ ] **Step 2: Run them.** Run: `pnpm --filter @ptcg/web exec vitest run test/frontier-pool.test.ts`
  Expected: FAIL (module not found).
- [ ] **Step 3: Implement** per the rules above.
- [ ] **Step 4: Run them again.** Expected: PASS.
- [ ] **Step 5: Commit** ("Frontier: package pool").

### Task 2: Deck rules and offers

**Files:**
- Modify: `packages/economy/src/decks.ts` (export `deckRuleProblems`), `packages/economy/test/decks.test.ts`
- Create: `apps/web/src/game/frontier/deck.ts`, `apps/web/src/game/frontier/offers.ts`
- Test: `apps/web/test/frontier-offers.test.ts`

**Interfaces:**
- Consumes: Task 1's `FrontierPackage`, `frontierPool`.
- Produces:
  ```ts
  // @ptcg/economy: the validator's size, copies, ACE SPEC and Basic checks, without legality or ownership
  export function deckRuleProblems(deck: DeckList, registry: CardRegistry): string[];
  // deck.ts
  export type RunCards = { id: string; count: number }[];
  export const runDeckProblems = (cards: RunCards, registry: CardRegistry): string[]; // deckRuleProblems + isPlayable
  export function applyChange(cards: RunCards, add: RunCards, cut: RunCards): RunCards; // merges, drops zero counts
  /** A legal cut of `n` cards from deck+add; with `keepAdded`, none of the added cards may be cut. */
  export function autoCut(cards: RunCards, add: RunCards, n: number, registry: CardRegistry, keepAdded?: boolean): RunCards | null;
  // offers.ts
  export type Offer = { kind: 'package'; pkg: FrontierPackage } | { kind: 'tuneup' };
  export const hasTuneup: (fightJustWon: number) => boolean;           // 1, 3, 5
  export function offersFor(o: { seed: number; fight: number; deck: RunCards }, pool: FrontierPackage[], registry: CardRegistry): Offer[];
  ```

- [ ] **Step 1: Write the failing tests:**
  - economy: `deckRuleProblems flags size, a 5th copy by name, a 2nd ACE SPEC and no Basic, and ignores format and ownership`
  - `runDeckProblems accepts all three starter decks` (Review Focus 1)
  - `applyChange adds, cuts, and removes cards that reach zero`
  - `autoCut keeps the deck legal; with keepAdded it never cuts the added cards; without it, it falls back to them`
  - `offersFor returns exactly 3 different offers after every fight 0..6 for 200 seeds across all three starter decks`
  - `every package offer can be kept whole (autoCut with keepAdded succeeds); no 5th copy of a name, no 2nd ACE SPEC`
  - `a Tune-up is among the 3 only after fights 1, 3 and 5`
  - `same seed, fight and deck give the same offers`
  - `tier odds follow the table (over 3000 draws per band, within 4 points, falling back a tier when none fits)`
- [ ] **Step 2: Run them.** Expected: FAIL (exports not found).
- [ ] **Step 3: Implement.** `deckRuleProblems` reuses the private `validate` in `decks.ts` with an always-true
  legality check and no ownership check. `autoCut` removes N cards preferring (1) copies causing a violation,
  (2) basic Energy, (3) Trainers with the highest count, (4) non-Basic Pokémon, then (without `keepAdded`) the added
  cards; never the last Basic Pokémon; returns `null` unless `runDeckProblems` is `[]`. `offersFor` uses
  `nextRandom` seeded by `(seed ^ Math.imul(fight + 1, 0x9e3779b1)) >>> 0`: pick a tier by the band's odds, then a
  package of that tier that can be kept whole; fall back to a lower tier if none.
- [ ] **Step 4: Run them again.** Expected: PASS.
- [ ] **Step 5: Commit** ("Frontier: deck rules and offers").

### Task 3: Opponents and Frontier Brains

**Files:**
- Create: `apps/web/src/game/frontier/opponents.ts`
- Test: `apps/web/test/frontier-opponents.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface FrontierOpponent {
    source: 'catalog' | 'gym'; id: string;   // DeckId or a LEADERS id
    name: string;                             // DeckInfo.name, or the leader's name + "'s deck"
    type: string;                             // DeckInfo.type, or LEADERS[].type
    cover: string;                            // DeckInfo.cover; for Gym decks the deck's first Pokémon of its highest stage
    difficulty: 'easy' | 'medium' | 'hard';
    brain?: string;                           // set on the boss only
  }
  export const FRONTIER_BRAINS: Record<string, { name: string; intro: string; win: string; lose: string }>; // key: meta DeckId
  export function drawOpponents(seed: number, starterId: string): FrontierOpponent[];   // 8
  export function opponentDeck(o: FrontierOpponent): DeckList;
  ```
  Brain names: meta-dragapult "Vesper", meta-alakazam "Quill", meta-ogerpon-box "Thorne", meta-ns-zoroark "Nox",
  meta-slowking "Brine", meta-crustle "Granite". Each has an `intro`, `win` and `lose` line in the tone of the Gym
  Leaders.

- [ ] **Step 1: Write the failing tests:**
  - `draws 8 opponents: difficulties easy x3, medium x3, hard x2`
  - `no deck repeats in a run, and none is the starter the player picked` (200 seeds × the three starters)
  - `fights 7 and 8 are meta decks; fights 1-3 are starter or theme decks; fights 4-6 are theme, Gym Leader or meta decks`
  - `the boss carries a brain whose key matches its meta deck`
  - `every opponent has a name, type and a cover card in the registry`
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
    starterChoices: string[];            // the 3 starter DeckIds, in seeded order
    starterId: string | null;
    fight: number;                       // 0..7, next or current fight
    lives: number;                       // 2..0
    wins: number;                        // fights won
    deck: RunCards; cover: string;       // cover: the starter deck's cover card
    opponents: FrontierOpponent[];
    offers: Offer[] | null;              // drawn by offersFor when a fight is won
    inMatch?: boolean;
    cleared?: boolean;
  }
  export function newRun(seed: number): FrontierRun;                       // phase 'starter'
  export function chooseStarter(r: FrontierRun, id: string): FrontierRun;  // -> 'hub'
  export function beginFight(r: FrontierRun): FrontierRun;                 // sets inMatch
  export function recordResult(r: FrontierRun, outcome: 'win' | 'loss' | 'draw'): FrontierRun;
  export function takeOffer(r: FrontierRun, index: number, cut: RunCards, energyTypes?: EnergyType[]): FrontierRun;
  export function skipOffer(r: FrontierRun): FrontierRun;
  export function abandon(r: FrontierRun): FrontierRun;                    // -> 'over', not cleared
  export const payout: (r: FrontierRun) => number;                         // credits
  export const keepableCards: (r: FrontierRun) => string[];                // card ids, no basic Energy
  ```
  Invalid calls (wrong phase, wrong cut size, illegal resulting deck) throw `Error`. For a Tune-up, `cut` has 0–3
  cards and `energyTypes` has the same length; each becomes one copy of that type's `mee-00x` card.

- [ ] **Step 1: Write the failing tests:**
  - `newRun lists the 3 starter decks in a seeded order`
  - `choosing a starter makes it the run deck, draws 8 opponents and enters the hub`
  - `a win on fights 1-7 opens the reward phase with 3 offers; a win on fight 8 clears the run (phase over, cleared)`
  - `a loss costs a life and replays the same fight; the second loss ends the run`
  - `a draw replays the fight with no life lost`
  - `beginFight sets inMatch and recordResult clears it`
  - `takeOffer adds the package, cuts exactly N cards, keeps the deck legal and moves to the next fight`
  - `takeOffer throws for a wrong cut size, an illegal deck, and the wrong phase`
  - `a Tune-up replaces 0-3 cut cards with the chosen basic Energy (mee-00x)`
  - `skipOffer moves to the next fight with the deck unchanged`
  - `payout: Easy 60, Medium 120, Hard 200, boss +300; a full clear is 1240; fights not won pay nothing`
  - `abandon pays for fights already won` and `keepableCards excludes basic Energy`
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement** each function as a pure transformation (copy, never mutate).
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
  export interface FrontierPayout { counted: boolean; outcome: 'win' | 'loss' | 'draw'; lives: number; phase: FrontierRun['phase'] }
  // Profile gains: frontier: FrontierProgress
  // useProfile gains:
  startFrontierRun(): Promise<void>;                        // no-op while any run exists (claim it first)
  chooseFrontierStarter(id: string): Promise<void>;
  beginFrontierMatch(): Promise<void>;
  recordFrontier(o: { seed: number; fight: number; won: boolean; draw: boolean }): Promise<FrontierPayout | undefined>;
  takeFrontierOffer(index: number, cut: RunCards, energyTypes?: EnergyType[]): Promise<void>;
  skipFrontierOffer(): Promise<void>;
  abandonFrontierRun(): Promise<void>;
  endFrontierRun(keepCardId: string | null): Promise<{ credits: number } | undefined>;
  settleUnfinishedFrontierMatch(): Promise<void>;           // inMatch run -> recorded as a loss
  ```

- [ ] **Step 1: Write the failing tests:**
  - `an old profile without frontier loads with no run and an empty Hall of Fame`
  - `a malformed run (wrong types, 3 lives, unknown phase, unknown card or opponent id) is dropped on load, not thrown`
  - `startFrontierRun / chooseFrontierStarter / skip / take save through the store; startFrontierRun does nothing while a run exists`
  - `recordFrontier counts a result once per game seed, and ignores a result whose fight is not the run's current fight or when no match is in progress` (Review Focus 3)
  - `settleUnfinishedFrontierMatch records a loss for a run saved with inMatch` (Review Focus 2)
  - `endFrontierRun pays the credits, adds the kept card to the collection, clears the run`
  - `a cleared run adds a Hall of Fame entry (newest first, capped at 20); a lost run does not`
  - `abandonFrontierRun ends the run and pays for fights won`
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.** Follow `recordElite` / `beginEliteMatch` / `abandonUnfinishedRun` in `useProfile.ts` for
  the `change(...)` queue and the `awardedGames` seed bookkeeping. `normalizeProfile` calls
  `normalizeFrontier(raw.frontier)`.
- [ ] **Step 4: Run them again,** then `pnpm --filter @ptcg/web test`. Expected: PASS.
- [ ] **Step 5: Commit** ("Frontier: profile fields and actions").

### Task 6: Simulated runs

**Files:**
- Test: `apps/web/test/frontier-sim.test.ts` (first line `// @vitest-environment node`)

**Interfaces:**
- Consumes: Tasks 1–4, `runMatch`, `createEasyBot`, `createMediumBot`, `createHardBot` from `@ptcg/bots`.

- [ ] **Step 1: Write two tests:**
  - `rules-only: 300 seeded runs with random outcomes reach every fight, every offer kind and every tier, and the deck is
    always legal` — no games: each fight's outcome is drawn at random (win 70%, loss 20%, draw 10%), offers are taken
    at random with `autoCut(…, keepAdded = false)` or a random legal Tune-up. After every step assert
    `runDeckProblems(run.deck)` is `[]`. Assert that across all runs every fight index 0–7 was reached, and that a
    Tune-up, an `'ex'` package and an `'ace'` package were each taken at least once (Review Focus 5).
  - `games: 4 seeded runs played with bots finish with no engine violations` — 120 s timeout. Seat 0 is the run deck
    with the Easy bot; the opponent uses the band's bot (Medium with 2 samples; Hard with `maxRounds: 1`, frozen
    clock). A `runMatch` result of `null` (action cap) counts as a draw; after 3 draws in a row on one fight, count
    a loss. Assert `violations` is `[]` for every match and the deck stays legal.
- [ ] **Step 2: Run it.** Run: `pnpm --filter @ptcg/web exec vitest run test/frontier-sim.test.ts`
  Expected: PASS within the timeout. Any failure is a real bug in Tasks 1–4: fix it under systematic-debugging with a
  unit test in that task's file.
- [ ] **Step 3: Run `pnpm check`.** Open PR 1 ("Battle Frontier: rules and profile"), merge when CI is green, and check
  the production deploy. Nothing in the app uses the Frontier yet.

---

## PR 2 — Screens and match wiring

### Task 7: Match wiring

**Files:**
- Modify:
  - `apps/web/src/game/store.ts` (`GameContext`)
  - `apps/web/src/game/describe.ts` (`opponentName`)
  - `apps/web/src/game/awards.ts` (new `useFrontierResult`; `useGymResult` skips frontier contexts)
  - `apps/web/src/App.tsx`: `GymGameOver` only for gym and elite contexts; a placeholder Frontier panel with a Back
    button until Task 9; `reset` goes to `'frontier'`; `BATTLE_ROUTES` gains `'frontier'`
  - `apps/web/src/nav/useNav.ts` (`Route` gains `'frontier'`)
- Create: `apps/web/src/game/frontierMatch.ts`
- Test: `apps/web/test/frontier-match.test.tsx`

**Interfaces:**
- Produces:
  - `GameContext` adds `{ kind: 'frontier'; fight: number; opponent: string }`.
  - `startFrontierMatch(): Promise<void>`: calls `beginFrontierMatch`, then `useGame.start` with the run deck, the
    opponent's deck (`opponentDeck`), the band's difficulty, a fresh seed and the context above. `opponent` is the
    Brain's name for the boss, the deck name otherwise.
  - `useFrontierResult(): FrontierPayout | undefined`, modeled on `useGymResult`; it calls
    `recordFrontier({ seed, fight, won, draw })` once per finished game.

- [ ] **Step 1: Write the failing tests:**
  - `startFrontierMatch starts a bot game with the run deck, the opponent deck and the band's difficulty`
  - `opponentName returns the context's opponent for a frontier game`
  - `a finished frontier game calls recordFrontier once with its fight, won and draw`
  - `a finished frontier game shows the Frontier panel, not the Gym game-over screen` (Review Focus 4)
  - `quitting a frontier match counts as a loss (concede) and the result goes to recordFrontier`
  - `no normal Duel credits are paid for a frontier game`
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement** per the files list.
- [ ] **Step 4: Run them again.** Expected: PASS.
- [ ] **Step 5: Commit** ("Frontier: match wiring").

### Task 8: Hub, starter pick and deck view

**Files:**
- Create: `apps/web/src/screens/BattleFrontier.tsx`, `apps/web/src/ui/frontier/FightTrack.tsx`,
  `apps/web/src/ui/frontier/OpponentCard.tsx`, `apps/web/src/ui/frontier/RunDeckView.tsx`
- Modify: `apps/web/src/screens/MainMenu.tsx` (ITEMS: `{ id: 'frontier', label: 'Battle Frontier' }` after Gym
  Challenge), `apps/web/src/App.tsx` (`SCREENS`)
- Test: `apps/web/test/frontier-screen.test.tsx`

- [ ] **Step 1: Write the failing tests:**
  - `the main menu has Battle Frontier, and Collector mode hides it` (the menu item and the route)
  - `with no run, the screen offers Start run; starting shows the 3 starter deck tiles`
  - `picking a starter shows the hub: lives, the 1-8 fight track with a boss mark, the next opponent card (name, type, cover, difficulty), View deck, Fight, Abandon run`
  - `View deck lists the run deck grouped as Pokémon, Trainers and Energy with counts, 60 in total`
  - `Abandon run asks to confirm`
  - `Fight starts the match (startFrontierMatch is called)`
  - `a run saved with inMatch is settled as a loss when the screen opens`
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement** the screen as a switch on `profile.frontier.run?.phase`, calling
  `settleUnfinishedFrontierMatch` in an effect on mount (like `abandonUnfinishedRun` in `GymChallenge.tsx`). Card art
  uses `${registry.defs[cover].image}/low.webp` as in `GymChallenge.tsx`; the boss card adds the Brain's name.
- [ ] **Step 4: Run them again.** Expected: PASS.
- [ ] **Step 5: Commit** ("Frontier: hub, starter pick and deck view").

### Task 9: Reward, cut picker, end of run

**Files:**
- Create: `apps/web/src/ui/frontier/RewardPanel.tsx`, `apps/web/src/ui/frontier/CutPicker.tsx`,
  `apps/web/src/ui/frontier/RunEnd.tsx`, `apps/web/src/ui/FrontierGameOver.tsx`
- Modify: `apps/web/src/screens/BattleFrontier.tsx`; `apps/web/src/App.tsx` (replace Task 7's placeholder with
  `FrontierGameOver`)
- Test: `apps/web/test/frontier-reward.test.tsx`

**Interfaces:**
- `CutPicker` props: `{ deck: RunCards; add: RunCards; count: number; tuneup?: boolean; onConfirm(cut: RunCards, energyTypes?: EnergyType[]): void }`.
  It lists deck + added cards grouped Pokémon / Trainers / Energy. Confirm is enabled only when the pick is the right
  size (exactly `count`; for a Tune-up 0–3, each with an Energy type) and `runDeckProblems` of the result is `[]`.

- [ ] **Step 1: Write the failing tests:**
  - `reward phase shows 3 offers with their cards, plus Skip`
  - `taking a package opens the cut picker; Confirm stays disabled until exactly N cards are picked and the deck is legal`
  - `a Tune-up lets the player cut 0-3 cards and pick a basic Energy type for each`
  - `Skip moves on without changing the deck`
  - `after a win the Frontier game-over panel says Continue and leads to the reward phase; after a loss it shows lives left and Retry`
  - `the boss's intro, win and lose lines appear on the boss fight's panels`
  - `the end-of-run screen shows fights won and credits, a keep-1-card picker (basic Energy not listed, decline allowed), then the Hall of Fame`
  - `a cleared run shows up in the Hall of Fame list`
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement** with existing retro components (`Box`, `Button`, `DialogBox`, `CardThumb`). Follow
  `GymGameOver.tsx` for the result dialog and play `sfx` the same way.
- [ ] **Step 4: Run them again.** Expected: PASS.
- [ ] **Step 5: Commit** ("Frontier: rewards, cut picker, end of run").

### Task 10: End-to-end and ship

**Files:**
- Create: `apps/web/e2e/frontier.spec.ts`

- [ ] **Step 1: Write the Playwright test** `a run: start, pick a starter, win fight 1, take an offer, reload to fight 2`.
  Open `/?e2e` (needed for `window.__game`), get past the intro, open Battle Frontier, start a run and pick the first
  starter. Press Fight, then make the bot concede with `window.__game.getState().dispatch(1, { type: 'concede' })`.
  Press Continue, take the first package offer and confirm a cut. Reload `/?e2e`, open Battle Frontier again, and
  expect the hub to show fight 2. At a 390 px wide viewport, assert there's no horizontal scroll on the hub, reward
  and cut picker screens.
- [ ] **Step 2: Run it.** Kill any `vite preview` on port 4173, then run
  `PW_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome pnpm --filter @ptcg/web e2e`.
  Expected: every test passes, including the new one.
- [ ] **Step 3: Run `pnpm check`.** Open PR 2 ("Battle Frontier: screens"), merge when CI is green and check the
  production deploy.
