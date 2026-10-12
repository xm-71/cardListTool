# Battle Frontier (roguelike run) — design

Date: 2026-10-11 · Status: approved in chat, awaiting written-spec review · Depends on: `2026-10-11-hard-bot-design.md`

## Goal

A single-player roguelike mode. The player drafts a deck as they go through 8 escalating bot fights with 2 lives.
Every run is fresh: the run deck is separate from the collection, and the player keeps a small reward at the end.

## Success criteria

- A run can be started, played through to a win or a loss, and resumed after a reload at any point between fights.
- The run deck is a legal 60-card deck after every pick: at most 4 copies of a card except basic Energy, at most
  1 ACE SPEC, and at least 1 Basic Pokémon.
- The same run seed always gives the same starter choices, opponents and offers, so reloading can't reroll them.
- Leaving a fight mid-match counts as a loss.
- Bot-simulated runs (bots play the fights and take random offers) finish with no engine violations and a legal deck
  after every pick.

## Rules

### Start

- **Battle Frontier** is a Main Menu entry, hidden in Collector mode like the other battle modes. **Start run** offers
  3 random starter decks from the built-in starters, and the pick becomes the **run deck**: a copy, so the collection
  and custom decks are never touched.
- A run has **8 fights** and **2 lives**. Only one run exists at a time; **Abandon run** ends it as a loss, with the
  normal end-of-run rewards for fights already won.

### Opponents

Drawn from the run seed at the start of the run, with no deck repeated in a run. The next opponent (name, type,
cover card) is always shown before the fight.

| Fights | Bot | Deck pool |
| --- | --- | --- |
| 1–3 | Easy | Starter and theme decks |
| 4–6 | Medium | Theme, Gym Leader and meta decks |
| 7 | Hard | Meta decks |
| 8 (boss) | Hard | Meta decks, played by a named **Frontier Brain** with intro, win and lose lines |

The opponent's deck is never the same deck as the starter the player picked.

### Rewards after a win (fights 1–7)

The player chooses **1 of 3 offers**, or **Skip**.

- **Package:** 2–4 cards that go together, taken from the pool. Kinds:
  - **Evolution line:** a Basic with its Stage 1, sometimes with its Stage 2. The usual shapes are 2-2, 2-1, 2-1-1
    and 1-1-1, and a line always includes the Pokémon each card evolves from.
  - **Trainer pair:** 2 copies of an Item, Supporter, Tool or Stadium, or 1 ACE SPEC.
  - **Special Energy:** 2 copies.

  After taking a package of N cards, the player picks exactly N cards from the run deck to **cut**. This includes cards
  just added, and the deck stays at 60 cards.
- **Tune-up** (one of the 3 offers after fights 2, 4 and 6): cut 0–3 cards and replace each with a basic Energy of the
  player's choice.
- Offers whose cards could break a deck rule even after the best possible cut aren't offered. The cut picker only
  allows a confirm that leaves the deck legal.
- **Card pool:** cards from the game's built-in decks (starter, theme, Gym and meta) that pass `isPlayable`. Evolution
  lines are built from cards that appear together in a built-in deck. Each package has a tier (plain, ex, ACE SPEC),
  and later fights favor higher tiers:

  | Fights | Plain | ex | ACE SPEC |
  | --- | --- | --- | --- |
  | 1–2 | 80% | 20% | 0% |
  | 3–5 | 55% | 40% | 5% |
  | 6–7 | 35% | 55% | 10% |

### Losses

A loss costs a life, and the player replays **the same fight** against the same opponent and deck with a new shuffle
(no reward). Losing the second life ends the run. A draw is replayed with no life lost. Quitting or reloading during a
match counts as a loss.

### End of run (cleared or lost)

- **Credits per fight won:** Easy 60, Medium 120, Hard 200, plus a **300 bonus** for beating the boss (a full clear
  pays 1,240).
- **Keep 1 card:** the player picks one card from the final run deck (not basic Energy), and one copy is added to the
  collection. The player can decline.
- A cleared run is added to the **Frontier Hall of Fame** (newest first, at most 20 entries) with the player's name,
  the date, the deck's cover card and the number of lives left.
- Normal per-game bot credits are **not** paid for Frontier fights.

## Architecture

### Pure rules: `apps/web/src/game/frontier/`

No React and no saving, in the same style as `gym.ts`. Every function takes a run and returns a new run.

- **`run.ts`:** `FrontierRun` and the state machine.

  ```ts
  interface FrontierRun {
    seed: number;
    phase: 'starter' | 'hub' | 'reward' | 'over';
    starterChoices: string[];          // starter deck ids
    fight: number;                     // 0..7, the next (or current) fight
    lives: number;                     // 2..0
    wins: number;
    deck: { id: string; count: number }[];
    cover: string;
    opponents: FrontierOpponent[];     // 8, fixed at start
    offers: Offer[] | null;            // when phase === 'reward'
    inMatch?: boolean;
    cleared?: boolean;
  }
  ```

  Functions:
  - `newRun(seed)`
  - `chooseStarter(run, id)`
  - `recordResult(run, outcome: 'win' | 'loss' | 'draw')`
  - `takeOffer(run, index, cuts, energies?)`
  - `skipOffer(run)`
  - `abandon(run)`
  - `payout(run): { credits }`
  - `keepableCards(run)`

  Invalid calls (wrong phase, an illegal cut) throw, and the store never saves them.
- **`pool.ts`:** `buildPool(decks, registry): Package[]`, built from the built-in decks and cached. Each package is
  `{ id, kind, tier, cards }`.
- **`offers.ts`:** `offersFor(run, pool, registry): Offer[]`, decided by `seed` and `fight`. It uses the existing
  deck validator from `@ptcg/economy` to check legality.
- **`opponents.ts`:** `drawOpponents(seed, starterId)` and the boss data.
- **Randomness:** all of it comes from `nextRandom` keyed on `seed` plus the fight number. Each match's shuffle seed is
  fresh (not stored), so replays shuffle differently.

### Profile

- `Profile.frontier: { run: FrontierRun | null; hallOfFame: FrontierHallEntry[] }`.
- `normalizeProfile` fills it in for older saves and drops a run that fails a shape check, rather than crashing.
- New store actions, modeled on the Elite Four ones:
  - `startFrontierRun()`
  - `chooseFrontierStarter(id)`
  - `beginFrontierMatch()`: saves `inMatch` before the game starts.
  - `recordFrontier({ seed, won, draw })`: at most once per game seed.
  - `takeFrontierOffer(i, cuts, energies?)`
  - `skipFrontierOffer()`
  - `abandonFrontierRun()`
  - `endFrontierRun(keepCardId | null)`: pays the credits, adds the kept card, records the Hall of Fame entry and
    clears the run.
- On load, a run with `inMatch` set (the page was left mid-match) is recorded as a loss.

### Match wiring

- `GameContext` gets `{ kind: 'frontier'; fight: number }`.
- `startFrontierMatch()` starts the game with the run deck, the opponent's deck and the band's difficulty.
- `awards.ts` sends Frontier results to `recordFrontier` instead of paying normal credits.
- `describe.ts` / `opponentName` names the boss in the ticker.
- The Hard difficulty comes from the Hard bot spec.

### Screens

New `screens/BattleFrontier.tsx` plus components in `ui/frontier/`:

- **Starter pick:** 3 deck tiles (cover, name, type).
- **Hub:** lives, the 1–8 fight track with a boss icon, the next opponent card, and the buttons View deck, Fight and
  Abandon run (with a confirm).
- **Reward:** 3 offer cards listing their contents, plus Skip. Next comes the **cut picker**, which lists the run deck
  grouped as Pokémon, Trainers and Energy. Its confirm is enabled only when exactly N cards are picked and the deck is
  legal. Tune-up uses the same picker plus an Energy type selector.
- **End of run:** won or lost, fights won, credits, a keep-1-card picker, then the Hall of Fame.
- Built from the existing retro UI pieces, it works at phone width (16px gutters, no horizontal scroll) and in both
  light and dark mode.

### Bots

- Frontier opponents use the existing bots: Easy, Medium, and Hard from the Hard bot spec.
- A Frontier simulation test (in `apps/web/test`, because the Frontier modules live in `apps/web`) plays N seeded runs end to end with bots on both sides and random
  offers and cuts. After every pick it checks that the deck is legal, and it checks that no game has invariant
  violations. Medium and Hard use fixed rounds so the test stays fast.

## Testing

- **Unit tests for `run.ts`:**
  - Each phase transition.
  - A win opens the offers.
  - A loss costs a life and replays the same fight, and a second loss ends the run.
  - A draw replays the fight with no life lost.
  - Wrong-phase calls throw.
  - The payout math, including the boss bonus.
  - Abandoning pays for fights already won.
- **Unit tests for `pool.ts`, `offers.ts` and `opponents.ts`:**
  - Every evolution line includes the Pokémon each card evolves from.
  - Every offer can be taken with some legal cut, across many seeds.
  - Tier odds follow the table above.
  - The same seed gives the same results.
  - There are no repeated opponents, and no opponent uses the chosen starter deck.
- **Profile tests:**
  - An old save without `frontier` loads.
  - A broken run is dropped.
  - `recordFrontier` runs only once per seed.
  - A run left with `inMatch` set counts as a loss.
  - The kept card is added to the collection.
  - Hall of Fame entries are capped at 20.
- **Component tests:** the starter pick, the hub, the reward and cut picker (confirm disabled until valid) and the
  end-of-run screen.
- **Playwright:** start a run, pick a starter, win fight 1 through a test hook, take an offer with a cut, and check
  that the hub shows fight 2 after a reload.

## Out of scope

- A branching map, shops, rest stops or events.
- Ascension or difficulty levels, daily seeded runs, and run history beyond the Hall of Fame.
- Using cards from the player's collection in a run.

## Delivery

Ships after the Hard bot PR, in 2 PRs on `claude/kind-meitner-2p99da`. Each gets green CI and a merge, then I check
the production deploy:

1. **Rules and profile:** `frontier/` modules, profile field and actions, unit tests, and the bot simulation test.
2. **Screens and match wiring:** components, Main Menu entry, `awards.ts` and `describe.ts`, component tests and
   the Playwright test.
