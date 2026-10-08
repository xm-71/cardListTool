# Browser Pokémon TCG — Design Spec

Date: 2026-10-08
Status: Draft for review

## 1. Purpose

A private, browser-based Pokémon Trading Card Game for the owner and their friends:
play real Pokémon TCG matches against bots or each other online, open packs with
credits earned from bot matches, and build decks from what you collect.

Not a public or commercial product. Pokémon names, card text, and art belong to
Nintendo / Creatures / GAME FREAK / The Pokémon Company; the site stays private
(no ads, no sales, no public promotion).

### Success criteria

- A full game under 2026–27 Standard rules can be played start to finish in the browser.
- You can play against an Easy or Medium bot, or against a friend through a room link.
- Bot matches earn credits; credits buy packs; opened cards land in a binder; playable
  owned cards can be built into custom decks.
- The site is deployed on Vercel.

### Assumptions (confirm or correct)

- Desktop browser first; phone/tablet usable but not polished in v1.
- Card images are loaded at runtime from the TCGdex CDN (private use).
- Free-to-cheap hosting.

## 2. Scope and milestones

Each milestone ends with something playable.

| # | Milestone | Outcome |
|---|-----------|---------|
| M1 | Rules engine + 2 starter decks | Headless engine; bot-vs-bot games run to completion in tests |
| M2 | Game board UI + Easy bot | Play vs Easy bot or hotseat in the browser; first Vercel deploy |
| M3 | All starter decks + deck picker + Medium bot | Pick decks, real games vs a decent bot |
| M4 | Packs & credits | Earn credits vs bots, buy/open packs, binder, deck builder (playable owned cards) |
| M5 | Online rooms | Create a room, share a link, play a friend |
| M6 | Meta decks | 3–4 researched current-meta decks, approved by the owner |

Before M1 work starts, the old Angular starter files are deleted in their own commit.

### Future features (out of scope for v1; the design must not block them)

- Hard bot (search-based, e.g. Monte Carlo tree search / determinized rollouts).
- Classic-era ruleset (Base / Jungle / Fossil) as a second `Ruleset`.
- Full Standard card pool, then the wider back catalogue / Expanded.
- Accounts (server-side profile replacing local storage), later an invite-only allowlist.
- Match history and replays (enabled by the seeded, deterministic engine).

## 3. Rules target

- 2026–27 Standard format: cards with regulation mark H or later (late Scarlet & Violet
  series + Mega Evolution series). Includes Pokémon ex, Mega Pokémon ex, Tera, ACE SPEC,
  Stadiums, Tools, Supporters (1 per turn), first-player-can't-attack-or-play-Supporter
  turn-1 rule, prize rules (ex = 2 prizes, Mega ex = 3), special conditions, weakness
  ×2 / resistance −30, retreat, mulligans, sudden-death not required in v1.
- The authoritative reference is the current official Pokémon TCG rulebook; rule
  details are implemented and tested one by one in M1.
- Starter decks: the official pre-built decks (ex Battle Deck / Mega Evolution-era
  Battle Deck products) whose lists fit the 2026–27 pool. Exact list is confirmed during
  planning. M1 uses 2 of them; M3 adds the rest.

## 4. Architecture

TypeScript monorepo (pnpm workspaces, strict TS).

```
packages/
  engine/    pure rules engine — no DOM, no network; seeded RNG only
  cards/     card data (generated from TCGdex) + effect code per card; "playable" flag
  bots/      Easy (heuristic), Medium (scored 1-ply lookahead); Hard later
  economy/   credit rewards, pack definitions, pack opening
apps/
  web/       React + Vite UI: board, deck picker, shop, binder, deck builder
  server/    (M5) authoritative room server running the same engine
```

### 4.1 Engine

- `GameState` is plain, JSON-serializable data. Cloning it is cheap and safe.
- Core API:
  - `createGame(config: { ruleset, decks, seed }) → GameState`
  - `getLegalActions(state, playerId) → Action[]`
  - `applyAction(state, action) → { state, events: GameEvent[] }` (pure; throws a typed
    `IllegalActionError` if the action is not legal)
  - `viewFor(state, playerId) → PlayerView` (hides the opponent's hand, both decks,
    face-down prizes, and the RNG seed)
- **Pending prompts.** When an effect needs a decision ("choose 2 Energy to discard",
  "search your deck for a Basic"), the state holds a `pendingPrompt` naming the deciding
  player and its options; the only legal actions are answers to it. UI, bots, and the
  network all handle decisions the same way.
- **Randomness.** A seeded PRNG stored in the state drives shuffles and coin flips, so
  every game is replayable from `(seed, actions)`.
- **Ruleset interface.** Setup, turn structure, first-turn limits, prize values, deck
  validation, and win conditions sit behind `Ruleset`. `standard2026` is the first
  implementation; `classic` is a future one.
- **Card effects as hooks.** Card definitions supply effects via hooks (`onPlay`,
  attack `effect`, abilities, `modifyDamage`, `onBetweenTurns`, `canRetreat`, …) rather
  than special cases inside the engine. Effects return engine operations (draw, discard,
  damage, prompt, …) so they stay testable.
- **Invariants** checked in tests and dev builds: each player always has exactly 60 cards
  across all zones, no card is in two zones, HP/damage are non-negative, and a game always
  ends.

### 4.2 Cards

- A build-time script pulls card fields (name, HP, types, attacks, costs, weakness,
  resistance, retreat, regulation mark, rarity, set, number, image URL) from TCGdex into
  committed JSON. The app never calls the API for gameplay data.
- Each implemented card has an effect module in `packages/cards/src/effects/<set>/<number>.ts`
  and a test. Cards without effect code are `playable: false`. Vanilla cards (attacks with
  no text) are playable by data alone.
- Card images load from the TCGdex image CDN at runtime in the player's browser, with a
  text-rendered fallback card if an image fails to load.

### 4.3 Bots

- Bots receive only a `PlayerView` plus the legal actions, never the full state.
- **Easy:** heuristic priorities, with a little randomness so games vary: evolve, attach
  energy toward the active attacker, play draw/search Trainers, attack for the most damage.
- **Medium:** for each legal action, simulate it on a *determinized* state (hidden cards
  sampled randomly from what is unknown) and score the result: prize lead, knockouts,
  damage dealt/taken, energy on board, hand size, bench development. Pick the best,
  averaged over several samples.
- Bots run in a Web Worker in the browser; the UI adds a short delay between bot actions so
  the human can follow the game.

### 4.4 Economy (M4)

- **Credits.** New profile starts with 500. Win vs Easy: +100; win vs Medium: +200;
  a loss gives +30 / +50. Conceding gives nothing. Online and hotseat games give no
  credits in v1. The values live in one config file.
- **Packs.** Price: 150 credits. The shop offers 1–2 Standard-legal expansions, chosen at
  M4. A pack has 10 cards using modern slot structure: 4 common, 3 uncommon, 2 reverse-holo
  slots (any rarity up to rare, with small upgrade chances to illustration rares), and
  1 rare-or-better slot (rare / double rare / ultra rare / illustration rare / special
  illustration rare / hyper rare) using approximate public pull rates. Opening uses its own
  RNG and is animated one card at a time.
- **Binder.** All owned cards grouped by set, with counts, rarity, and a "Playable" badge.
  Unowned cards in the set appear greyed out.
- **Deck builder.** 60 cards; at most 4 of any name (basic Energy unlimited); at least one
  Basic Pokémon; at most 1 ACE SPEC; only H-mark-or-later cards; only cards that are owned
  **and** playable. Basic Energy is free and unlimited. Starter decks are always available
  and do not need owning.
- **ProfileStore interface** (`getProfile`, `addCredits`, `spendCredits`, `addCards`,
  `saveDeck`, …) backed by IndexedDB in v1. Values are local to one browser and can be
  edited by the user — accepted for a private game. Future accounts replace this with a
  server-backed implementation; the server then grants credits from games it ran itself.

### 4.5 Web app

- React + Vite + TypeScript, Tailwind for styling, Zustand for UI state.
- Screens: Home → Play (choose opponent: Easy bot / Medium bot / hotseat / online room) →
  Deck picker → Game board; Shop; Binder; Deck builder.
- **Board layout:** opponent on top, you on the bottom. Each side shows the Active Pokémon,
  a Bench (5), Prizes (6), deck count, discard pile; the Stadium is in the middle; your hand
  is along the bottom. A game log sits at the side. Hover/long-press zooms a card.
- **Interaction:** the UI only offers moves from `getLegalActions`. Click a card to see its
  available actions (Play, Attach to…, Evolve…, Retreat, Attack: …). Prompts open as a
  modal or highlight the valid targets. End Turn is an explicit button.
- Hotseat hides the hand behind a "pass the device" screen between turns.

### 4.6 Online rooms (M5)

- The room server runs the same engine and holds the authoritative state. Clients send
  `Action`s, and the server validates them and broadcasts each player's own `PlayerView`
  plus events.
- Room link: `/room/<random-id>`. The first two visitors are the players. A reconnect within
  the timeout resumes the seat, using a token kept in the browser.
- Hosting: Vercel serves the web app but does not host long-lived WebSocket rooms. The
  recommended option is Cloudflare Durable Objects (via PartyKit) for per-room state with
  pay-per-use billing; Colyseus on a small VM is the alternative. Final choice at M5.

## 5. Error handling

- The engine rejects illegal actions with `IllegalActionError`. The UI never sends them,
  and the server drops them and resyncs the client.
- A card effect that throws is a bug: in dev it surfaces loudly; in production the game
  shows "something went wrong" with an option to save the seed + action log for a bug
  report.
- Failed image loads fall back to the text-rendered card.
- If profile storage is unavailable (e.g., private browsing), the app runs with an
  in-memory profile and warns that progress will not be saved.

## 6. Testing

- **Vitest** for all packages.
- **Engine:** one or more tests per rule (setup/mulligan, turn-1 limits, attach once,
  Supporter once, retreat, weakness/resistance, special conditions, knockouts and prizes,
  win conditions, deck-out).
- **Cards:** each effect module has a test that sets up a state, plays the card, and checks
  the result.
- **Fuzz:** thousands of seeded bot-vs-bot games per deck pairing, checking invariants and
  that every game ends. Failures print the seed for replay.
- **Economy:** pack-opening distribution tests over many seeded openings; deck-builder
  validation tests.
- **Web:** component tests for key screens plus a Playwright smoke test (start a game vs
  the Easy bot, play a turn, open a pack).
- CI: GitHub Actions running typecheck, lint, and tests on every push.

## 7. Deployment

- `apps/web` is deployed to Vercel as a static Vite build from M2 onward. Preview deploys
  are made for branches and production for `main`. Monorepo root: `apps/web`, with
  workspace packages built first.
- M5 adds the room server on its chosen host, with its URL given to the web app by an
  environment variable.

## 8. Known constraints

- This cloud environment's network policy currently blocks `api.tcgdex.net`. Allowing
  `api.tcgdex.net` and `assets.tcgdex.net` is needed to run the card-data import here.
  Until then, the M1 cards can be entered by hand from official card text.
- The exact starter decklists and pack pull rates are confirmed during planning, against
  the 2026–27 legal pool.
