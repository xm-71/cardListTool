# M1 — Rules Engine + 2 Starter Decks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A headless TypeScript Pokémon TCG rules engine (2026–27 Standard rules) that plays complete, seeded, replayable games with the Mega Gengar ex and Mega Diancie ex Mega Battle Decks, driven by an Easy bot in tests.

**Architecture:** A pnpm monorepo. `packages/engine` is a pure rules engine. It is bound to a card registry through `createEngine(registry)` and exposes `createGame / getLegalActions / applyAction / viewFor` over plain JSON state. Card effects are scripts that call an effect context. A choice inside an effect pauses the game with a `pendingPrompt`, and resuming *replays* the effect from a pre-effect snapshot with the recorded answers, so state never holds closures. `packages/cards` holds normalized TCGdex data, decklists and effect scripts. `packages/bots` holds the Easy bot and a match runner.

**Tech Stack:** Node 22, pnpm 10, TypeScript 5 (strict), Vitest, ESLint (typescript-eslint) + Prettier, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-08-pokemon-tcg-browser-game-design.md` (§3 Rules target, §4.1 Engine, §4.2 Cards, §4.3 Bots, §6 Testing).

## Global Constraints

- TypeScript `strict: true`; ESM everywhere (`"type": "module"`).
- `packages/engine` and `packages/bots` import nothing from DOM or network APIs, and never call `Math.random` or `Date.now`. All randomness comes from the seeded RNG.
- `GameState` must survive `JSON.parse(JSON.stringify(state))` unchanged (no classes, Maps, functions or undefined-vs-missing drift).
- Rules: 2026–27 Standard. Deck = 60, hand unlimited, Bench max 5, 6 Prizes, Weakness ×2, Resistance −30, 1 Energy attachment per turn from hand, 1 Supporter per turn, 1 retreat per turn, Stadium/Tool rules as in the official rulebook.
- Prize values: normal Pokémon 1, Pokémon ex 2, Mega Evolution Pokémon ex 3.
- The first player draws on turn 1 but cannot attack or play a Supporter that turn. Neither player can evolve on their own first turn, or evolve a Pokémon put into play that turn.
- Known simplifications (documented in `packages/engine/README.md`):
  - The winner of the opening coin flip always goes first.
  - The opponent's mulligan bonus draws are taken automatically.
  - Simultaneous win conditions are a draw (no sudden death).
  - Prize cards are taken from the top of the prize pile.
- Card data source: TCGdex API `https://api.tcgdex.net/v2/en/cards/<id>`. Images are not downloaded in M1.

## Review Focus

1. **Effects with nothing to find or target.** Searching an empty or target-less deck, Boss's Orders with an empty opponent Bench, Switch with an empty Bench, Rare Candy without a matching Stage 2, Wondrous Patch with no Energy in the discard pile. Expected: cards that need a target are not offered as legal actions. "Search" cards are still playable and simply find nothing. *(Owned by Tasks 8, 9.)*
2. **Overdrawing inside an effect.** Lillie's Determination with 3 cards left in the deck. Expected: draw as many as possible and do not lose. A player only loses for being unable to draw at the *start of turn*. *(Owned by Task 5.)*
3. **Full Bench.** Nest Ball, Buddy-Buddy Poffin, Call for Family or "play Basic" when 5 Pokémon are already Benched. Expected: Nest Ball is not legal, play Basic is not legal, and Poffin / Call for Family only offer as many picks as there are free slots. *(Owned by Tasks 4, 8, 10.)*
4. **Double Knockout.** Punk Helmet Knocks Out the attacker while the attack Knocks Out the defender. Expected: both players take Prizes. Promotions happen with the non-current player choosing first, and a simultaneous win is a draw. *(Owned by Task 9.)*
5. **Stale or illegal actions.** The UI or network later sends an action that isn't in `getLegalActions`. Expected: `applyAction` throws `IllegalActionError` and the input state object is not mutated. *(Owned by Task 4.)*

---

## File Structure

```
package.json, pnpm-workspace.yaml, tsconfig.base.json, vitest.config.ts,
eslint.config.js, .prettierrc, .gitignore, .github/workflows/ci.yml, README.md

packages/engine/
  src/index.ts          public API re-exports
  src/types.ts          GameState, PlayerState, PokemonSlot, Action, Prompt, GameEvent, SlotRef
  src/cards.ts          CardDef types, CardScript / hook interfaces, CardRegistry
  src/rng.ts            seeded PRNG + shuffle + coin flip
  src/engine.ts         createEngine(registry) → Engine
  src/setup.ts          createGame, mulligans, setup prompts, prizes
  src/actions.ts        getLegalActions, applyAction dispatcher, IllegalActionError
  src/turn.ts           start/end of turn, draw, deck-out
  src/energy.ts         energy cost payment check
  src/effects.ts        EffectCtx implementation + prompt/replay machinery
  src/combat.ts         attack, damage pipeline, knockouts, prizes, promotion, win checks
  src/conditions.ts     special conditions + Pokémon Checkup
  src/trainers.ts       Item / Supporter / Stadium / Tool play rules
  src/view.ts           viewFor
  src/invariants.ts     checkInvariants(state) for tests/dev
  test/*.test.ts        one file per src module; test/fixtures.ts builds tiny registries & states
packages/cards/
  scripts/import-cards.ts   fetch TCGdex → src/data/cards.json
  src/normalize.ts          normalizeTcgdexCard(raw) → CardDef
  src/decks/mega-gengar.json, src/decks/mega-diancie.json
  src/data/cards.json       generated, committed
  src/scripts/<setId>/<localId>.ts   one CardScript per card with rules text
  src/registry.ts           buildRegistry() → CardRegistry
  test/…                    normalize tests + one test per card script
packages/bots/
  src/easy.ts           easyBot
  src/runMatch.ts       runMatch()
  src/demo.ts           CLI: print a full bot-vs-bot game log
  test/fuzz.test.ts     seeded bot-vs-bot games with invariants
```

## Core Types (decided here; every task uses these names)

```ts
// packages/engine/src/types.ts
export type PlayerId = 0 | 1;
export type EnergyType = 'Grass'|'Fire'|'Water'|'Lightning'|'Psychic'|'Fighting'|'Darkness'|'Metal'|'Dragon'|'Colorless';
export type SlotRef = { player: PlayerId; zone: 'active' } | { player: PlayerId; zone: 'bench'; index: number };
export interface CardInstance { uid: string; defId: string; owner: PlayerId }       // uid like "p0-c17"
export interface PokemonSlot {
  stack: string[];            // uids, last = the Pokémon in play (evolutions on top)
  energy: string[]; tool: string | null; damage: number;   // damage in HP (counters × 10)
  conditions: { rotation: 'none'|'asleep'|'confused'|'paralyzed'; poisoned: boolean; burned: boolean };
  enteredTurn: number; evolvedTurn: number | null;
  abilityUsedTurn: Record<string, number>;   // ability name → turn used
  cantAttackOnTurn: number | null;           // e.g. Eternatus Power Rush tails
}
export interface PlayerState {
  deck: string[]; hand: string[]; discard: string[]; prizes: string[];
  active: PokemonSlot | null; bench: PokemonSlot[];
  supporterTurn: number | null; energyTurn: number | null; retreatTurn: number | null; stadiumUsedTurn: number | null;
  mulligans: number;
}
export interface PromptOption { id: string; label: string; uid?: string; slot?: SlotRef }
export interface Prompt {
  player: PlayerId; kind: 'cards'|'slot'|'option'; message: string;
  options: PromptOption[]; min: number; max: number; selected: string[];  // one-at-a-time selection
}
export interface PendingEffect { snapshot: GameState; source: EffectSource; answers: string[] }
export type EffectSource =
  | { kind: 'attack'; slot: SlotRef; attackIndex: number }
  | { kind: 'ability'; slot: SlotRef; ability: string }
  | { kind: 'trainer'; uid: string; target?: SlotRef }
  | { kind: 'stadium' } | { kind: 'system'; name: 'setup'|'promote'|'retreatCost' };
export interface GameState {
  cards: Record<string, CardInstance>;
  players: [PlayerState, PlayerState];
  turn: number; current: PlayerId; first: PlayerId;
  phase: 'setup'|'main'|'gameOver';
  stadium: { uid: string; owner: PlayerId } | null;
  prompt: Prompt | null; pending: PendingEffect | null;
  rng: number;                                 // uint32 PRNG state
  result: { winner: PlayerId | 'draw'; reason: 'prizes'|'noPokemon'|'deckOut'|'concede' } | null;
  log: GameEvent[];
}
export type Action =
  | { type: 'playBasic'; uid: string }
  | { type: 'evolve'; uid: string; target: SlotRef }
  | { type: 'attachEnergy'; uid: string; target: SlotRef }
  | { type: 'playTrainer'; uid: string; target?: SlotRef }     // target used by Tools
  | { type: 'useAbility'; slot: SlotRef; ability: string }
  | { type: 'useStadium' }
  | { type: 'retreat'; benchIndex: number }
  | { type: 'attack'; attackIndex: number }
  | { type: 'endTurn' }
  | { type: 'answer'; optionId: string }                      // 'done' ends a multi-select once min is met
  | { type: 'concede' };
export type GameEvent = { type: string; player?: PlayerId; text: string; [k: string]: unknown };
```

```ts
// packages/engine/src/cards.ts
export interface AttackDef { name: string; cost: EnergyType[]; damage: number; damageSuffix: ''|'+'|'×'; text: string }
export interface AbilityDef { name: string; text: string }
export type CardDef =
  | { id: string; name: string; category: 'Pokemon'; stage: 'Basic'|'Stage1'|'Stage2'; hp: number;
      types: EnergyType[]; evolvesFrom: string | null; weakness: EnergyType | null; resistance: EnergyType | null;
      retreat: number; attacks: AttackDef[]; abilities: AbilityDef[]; isEx: boolean; isMega: boolean;
      regulationMark: string | null; rarity: string; image: string }
  | { id: string; name: string; category: 'Trainer'; trainerType: 'Item'|'Supporter'|'Stadium'|'Tool';
      text: string; isAceSpec: boolean; regulationMark: string | null; rarity: string; image: string }
  | { id: string; name: string; category: 'Energy'; energyKind: 'Basic'|'Special'; provides: EnergyType[];
      text: string; regulationMark: string | null; rarity: string; image: string };
export interface CardScript {
  attacks?: Record<number, { canUse?(ctx: EffectCtx): boolean; damage?(ctx: EffectCtx): number; effect?(ctx: EffectCtx): void }>;
  abilities?: Record<string, { canUse(ctx: EffectCtx): boolean; use(ctx: EffectCtx): void }>;   // activated
  trainer?: { canPlay(ctx: EffectCtx): boolean; play(ctx: EffectCtx): void };
  stadium?: { canUse(ctx: EffectCtx): boolean; use(ctx: EffectCtx): void;
              onBenchFromHand?(ctx: EffectCtx, slot: SlotRef): void };
  // passive hooks (evaluated by the engine, must not prompt)
  modifyOutgoingDamage?(q: DamageQuery): number;   // before W/R, active target only
  modifyIncomingDamage?(q: DamageQuery): number;   // after W/R
  modifyRetreatCost?(q: { state: GameState; slot: SlotRef; cost: number }): number;
  modifyPrizes?(q: { state: GameState; knockedOut: SlotRef; byAttackFromEx: boolean; prizes: number }): number;
  afterDamagedInActive?(ctx: EffectCtx, holder: SlotRef, attacker: SlotRef): void;   // Tools like Punk Helmet
  onEvolveFromHand?: { optional: true; use(ctx: EffectCtx, slot: SlotRef): void };   // Grumpig
}
export interface DamageQuery { state: GameState; attacker: SlotRef; defender: SlotRef; amount: number; registry: CardRegistry }
export interface CardRegistry { defs: Record<string, CardDef>; scripts: Record<string, CardScript> }
```

`EffectCtx` (Task 5) is the only way scripts touch state:
`me`, `opp`, `source`, `state` (read-only), `def(uid)`, `slot(ref)`, `draw(player, n)`, `shuffleDeck(player)`,
`moveCard(uid, to: { player, zone: 'hand'|'deck'|'discard'|'bench'|'deckBottom' })`, `putOnBench(player, uid)`,
`attachEnergy(uid, ref)`, `discardEnergy(ref, uids)`, `heal(ref, hp)`, `placeCounters(ref, n)`,
`switchActive(player, benchIndex)`, `flipCoin(): boolean`,
`chooseCards(o: { player, from: string[], min, max, message }): string[]`,
`chooseSlot(o: { player, among: SlotRef[], min, max, message }): SlotRef[]`,
`chooseOption(o: { player, options: { id, label }[], message }): string`, `log(text)`.

---

### Task 1: Clear the old repo and scaffold the monorepo

**Files:**
- Delete: `angular.json`, `package.json`, `tsconfig.json`, `src/` (whole tree)
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `vitest.config.ts`, `eslint.config.js`, `.prettierrc`, `.gitignore`, `.github/workflows/ci.yml`, `README.md` (rewrite), `packages/{engine,cards,bots}/package.json` + `tsconfig.json`, `packages/engine/src/index.ts`, `packages/engine/test/smoke.test.ts`

**Interfaces:**
- Produces: root scripts `pnpm test` (vitest run, all packages), `pnpm typecheck` (`tsc -b`), `pnpm lint`. Workspace package names `@ptcg/engine`, `@ptcg/cards`, `@ptcg/bots` (cards and bots depend on `@ptcg/engine` via `workspace:*`). Packages export TypeScript source directly (`"exports": "./src/index.ts"`), so no build step is needed for tests.

- [ ] **Step 1:** `git rm -r angular.json package.json tsconfig.json src` and commit `chore: remove old Angular starter`.
- [ ] **Step 2:** Create the root config files. `pnpm-workspace.yaml` lists `packages/*` and `apps/*`. `tsconfig.base.json` uses `strict`, `noUncheckedIndexedAccess`, `module: ESNext`, `moduleResolution: Bundler`, `target: ES2022`. The CI workflow runs on push and PR with Node 22 and pnpm 10: `pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm test`.
- [ ] **Step 3:** Write `packages/engine/test/smoke.test.ts`: `expect(ENGINE_VERSION).toBe('0.1.0')`. Run `pnpm test`, expect FAIL (no export).
- [ ] **Step 4:** Export `ENGINE_VERSION = '0.1.0'` from `packages/engine/src/index.ts`. Run `pnpm install && pnpm test && pnpm typecheck && pnpm lint`, expect all PASS.
- [ ] **Step 5:** Rewrite `README.md` with the project purpose (one paragraph from spec §1), the private-use note, and the dev commands. Commit `chore: scaffold pnpm monorepo with engine/cards/bots packages`.

### Task 2: Card data — normalizer, decklists, import script

**Files:**
- Create: `packages/engine/src/cards.ts` (types above), `packages/cards/src/normalize.ts`, `packages/cards/scripts/import-cards.ts`, `packages/cards/src/decks/mega-gengar.json`, `packages/cards/src/decks/mega-diancie.json`, `packages/cards/src/data/cards.json` (generated), `packages/cards/test/normalize.test.ts`, `packages/cards/test/fixtures/{me02-056,me02-094,mee-007}.json`

**Interfaces:**
- Consumes: `CardDef` from `@ptcg/engine`.
- Produces: `normalizeTcgdexCard(raw: unknown): CardDef`. `DeckList = { name: string; cards: { id: string; count: number }[] }` (exported from engine `types.ts`). `import cards from './data/cards.json'` gives a `Record<string, CardDef>` keyed by TCGdex id. `pnpm --filter @ptcg/cards import-cards` regenerates the data.

Decklists (TCGdex ids):

*Mega Gengar ex* — Pokémon: me02-054 Gastly ×4, me02-055 Haunter ×2, me02-056 Mega Gengar ex ×2, me02-067 Toxel ×2, me02-068 Toxtricity ×2, me02-059 Sableye ×2, me02-062 Seviper ×2, me02-069 Eternatus ×1. Trainers: me01-119 Lillie's Determination ×4, sv01-166 Arven ×2, me01-114 Boss's Orders ×2, sv02-185 Iono ×1, sv01-181 Nest Ball ×3, me01-167 Buddy-Buddy Poffin ×2, me01-131 Ultra Ball ×2, me01-125 Rare Candy ×2, me01-173 Night Stretcher ×2, me01-127 Risky Ruins ×2, me01-121 Mega Signal ×3, me02-092 Punk Helmet ×2, me01-130 Switch ×2, me01-166 Air Balloon ×1. Energy: mee-007 Darkness Energy ×13.
**Unconfirmed:** the last 10 Trainer slots (Risky Ruins ×2, Mega Signal ×3, Punk Helmet ×2, Switch ×2, Air Balloon ×1) fill the published-but-incomplete list up to 60. Flag them in a `"note"` field in the JSON for the owner to confirm.

*Mega Diancie ex* — Pokémon: me02-041 Mega Diancie ex ×2, me02-040 Meloetta ×2, me01-063 Grumpig ×2, me01-062 Spoink ×2, me02-044 Alcremie ×2, me02-043 Milcery ×2, me02-042 Mimikyu ×2, me02-039 Cresselia ×1, me02-045 Zacian ×1. Trainers: me01-119 Lillie's Determination ×4, me02-094 Wondrous Patch ×4, sv01-181 Nest Ball ×3, sv01-166 Arven ×2, me01-114 Boss's Orders ×2, me01-167 Buddy-Buddy Poffin ×2, me01-173 Night Stretcher ×2, me01-130 Switch ×2, me01-131 Ultra Ball ×2, me01-166 Air Balloon ×2, me01-122 Mystery Garden ×2, sv02-185 Iono ×1, sv09-155 Professor's Research ×1, me01-132 Wally's Compassion ×1. Energy: mee-005 Psychic Energy ×14.

(Some Trainers only exist in TCGdex as G-mark printings. Starter decks are fixed product lists, so legality is not checked for them.)

- [ ] **Step 1: Failing tests** in `normalize.test.ts`, using saved TCGdex fixtures (fetch with curl, strip `pricing` and `variants_detailed`):
  - me02-056 → `{ category:'Pokemon', name:'Mega Gengar ex', stage:'Stage2', hp:350, types:['Darkness'], evolvesFrom:'Haunter', weakness:'Fighting', resistance:null, retreat:2, isEx:true, isMega:true, regulationMark:'I' }`, `attacks[0]` = `{ name:'Void Gale', cost:['Darkness','Darkness'], damage:230, damageSuffix:'' }`, `abilities[0].name === 'Shadowy Concealment'`, `image === 'https://assets.tcgdex.net/en/me/me02/056'`.
  - me02-094 → `{ category:'Trainer', trainerType:'Item', name:'Wondrous Patch', isAceSpec:false }`.
  - mee-007 → `{ category:'Energy', energyKind:'Basic', provides:['Darkness'] }`.
  - The damage strings `"20+"`, `"120×"`, `undefined` → `(20,'+')`, `(120,'×')`, `(0,'')`.
- [ ] **Step 2:** Run `pnpm --filter @ptcg/cards test`, expect FAIL.
- [ ] **Step 3:** Implement `normalizeTcgdexCard`. `isEx` = name ends with `" ex"`; `isMega` = `isEx` and name starts with `"Mega "`; `isAceSpec` = rarity `"ACE SPEC Rare"`. Basic Energy `provides` = `[types[0]]` if present, else parsed from the name. Unknown categories throw.
- [ ] **Step 4:** Run the tests, expect PASS.
- [ ] **Step 5:** Write the two decklist JSON files. Implement `import-cards.ts`: read the decklists, fetch each unique id, normalize, write `src/data/cards.json` sorted by id. Run it. Add test `decks total 60 and every id exists in cards.json`, run it, expect PASS.
- [ ] **Step 6:** Commit `feat(cards): TCGdex normalizer, starter decklists, imported card data`.

### Task 3: Engine core — RNG, createEngine, createGame, setup

**Files:**
- Create: `packages/engine/src/{types.ts,rng.ts,engine.ts,setup.ts,invariants.ts}`, `packages/engine/test/{rng,setup}.test.ts`, `packages/engine/test/fixtures.ts`

**Interfaces:**
- Produces:
  - `nextRandom(rng: number): [value: number /*0..1*/, rng: number]` (mulberry32), `shuffle<T>(arr: T[], rng: number): [T[], number]`, `coinFlip(rng): [heads: boolean, rng]`.
  - `createEngine(registry: CardRegistry): Engine` where `Engine = { createGame(c: { decks: [DeckList, DeckList]; seed: number }): GameState; getLegalActions(s: GameState, p: PlayerId): Action[]; applyAction(s: GameState, p: PlayerId, a: Action): { state: GameState; events: GameEvent[] }; viewFor(s: GameState, p: PlayerId): PlayerView }`.
  - `checkInvariants(state): string[]` (empty = OK): each player owns exactly 60 uids across all zones (counting slot stacks, energy and tools), no uid appears twice, damage ≥ 0, bench ≤ 5.
  - `test/fixtures.ts`: `miniRegistry()` (a Basic "Testmon" with 60 HP, 1 attack [Colorless] 20 damage; a Stage 1 "Testevo"; Basic Darkness Energy; and a no-op Item) and `deckOf(spec: Record<defId, count>): DeckList`.
- Setup flow: shuffle each deck (seeded) and draw 7. If a hand has no Basic, reveal it, shuffle it back, redraw and count a mulligan; repeat. Each player's opponent then draws 1 card per mulligan (auto). The coin flip winner is `first`. Then setup prompts, `system:'setup'` with `player 0` and then `player 1`: choose 1 Basic as Active (`min 1, max 1`), then choose 0–5 Basics for the Bench. After both players are done: 6 Prizes each from the top of the deck, `phase = 'main'`, `turn = 1`, `current = first`, and the first player draws 1.

- [ ] **Step 1: Failing tests** (`rng.test.ts`): the same seed gives the same sequence. `shuffle` is a permutation. 10,000 coin flips at seed 1 give 45–55% heads.
- [ ] **Step 2: Failing tests** (`setup.test.ts`):
  - after `createGame` the prompt is for player 0, `kind 'cards'`, options = the Basics in player 0's hand;
  - answering both players' setup prompts → `phase 'main'`, each player has 6 prizes, `current === first`, the first player's hand size = 7 − (bench placed) − 1 + 1;
  - a deck of 1 Basic + 59 Energy at seed 42 still produces a legal start, and `mulligans` is counted;
  - `checkInvariants` is `[]` after setup;
  - `JSON.parse(JSON.stringify(state))` deep-equals `state`.
- [ ] **Step 3:** Run `pnpm --filter @ptcg/engine test`, expect FAIL.
- [ ] **Step 4:** Implement. Setup prompts use the prompt machinery from Task 5. For now implement `answer` handling for `system:'setup'` directly in `setup.ts`, and Task 5 generalizes it.
- [ ] **Step 5:** Run the tests, expect PASS. Commit `feat(engine): seeded RNG, game creation, mulligans, setup`.

### Task 4: Turn structure and basic actions

**Files:**
- Create: `packages/engine/src/{actions.ts,turn.ts,energy.ts}`, `packages/engine/test/{actions,turn}.test.ts`

**Interfaces:**
- Consumes: Task 3 types and `createEngine`.
- Produces: `IllegalActionError extends Error` (exported). `canPayCost(cost: EnergyType[], energyUids: string[], state, registry): boolean`, where typed symbols are matched by an Energy providing that type and `Colorless` by any. `getRetreatCost(state, slot, registry): number` (applies `modifyRetreatCost`, minimum 0). `startTurn(state)` and `endTurn(state)` in `turn.ts`.
- Rules: `playBasic` puts a Basic from hand onto the Bench (<5). `attachEnergy` once per turn. `evolve` needs a matching `evolvesFrom` name, the target's `enteredTurn < turn`, `evolvedTurn !== turn`, and not the player's own first turn; it clears special conditions. `retreat` once per turn, not while Asleep or Paralyzed; it opens a `system:'retreatCost'` prompt to pick which Energy to discard when there is a choice; it swaps the Active with the Bench, clearing conditions. `endTurn` runs the checkup (stub until Task 7) and the next player's `startTurn` draws 1. If their deck is empty they lose (`deckOut`). `concede` → the other player wins.

- [ ] **Step 1: Failing tests:**
  - legal actions on turn 1 for the first player include `playBasic`, `attachEnergy` and `endTurn`, but no `attack` and no `evolve`;
  - attaching twice in one turn: the second is not in legal actions, and applying it throws `IllegalActionError`;
  - `playBasic` is not legal with 5 Benched;
  - evolving a Pokémon benched this turn is not legal; next turn it is;
  - retreat with cost 1 and 2 attached Energy prompts for which to discard; after answering, the Active and Bench swap and `retreatTurn === turn`;
  - `canPayCost(['Darkness','Colorless'], [D, P])` is true; `(['Darkness','Darkness'], [D, P])` is false;
  - a player with an empty deck at start of turn loses with `reason 'deckOut'`;
  - **(Review Focus 5)** `applyAction` with an action not in legal actions throws, and `JSON.stringify(input)` is unchanged before vs after.
- [ ] **Step 2:** Run, expect FAIL. **Step 3:** Implement (`applyAction` deep-clones the input with `structuredClone` before mutating). **Step 4:** Run, expect PASS.
- [ ] **Step 5:** Commit `feat(engine): turn structure, play/attach/evolve/retreat, deck-out`.

### Task 5: Effect context, prompts and replay

**Files:**
- Create: `packages/engine/src/effects.ts`, `packages/engine/test/effects.test.ts`
- Modify: `packages/engine/src/actions.ts` (route `answer`, use `runEffect`), `packages/engine/src/setup.ts` (setup uses `runEffect` with `system:'setup'`)

**Interfaces:**
- Produces: `runEffect(state: GameState, source: EffectSource, fn: (ctx: EffectCtx) => void, answers?: string[]): GameState`, plus the `EffectCtx` methods listed under Core Types.
- Mechanism (the one non-obvious algorithm):
  ```
  runEffect(stateBefore, source, fn, answers=[]):
    work = clone(stateBefore); cursor = 0
    ctx.chooseX(...) → builds the option list;
        while the selection isn't finished:
          if cursor < answers.length: take answers[cursor++] ('done' finishes once min is met)
          else: throw NeedInput(prompt with selected-so-far)
    try fn(ctx) → work.pending = null; work.prompt = null; return work
    catch NeedInput(p) → result = clone(stateBefore); result.prompt = p;
                         result.pending = { snapshot: stateBefore, source, answers }; return result
  applyAction 'answer': validate the option is in prompt.options (or 'done' when selected ≥ min) →
     runEffect(pending.snapshot, pending.source, resolveFn(source), [...pending.answers, optionId])
  ```
  - `resolveFn(source)` looks up the script function from the registry (attack effect, ability `use`, trainer `play`, stadium `use`) or the system handler. This is why sources are data, not closures.
  - If a choice has no options, or `max === 0`, it returns `[]` without prompting.
  - If the options count equals `min === max`, it auto-selects without prompting.
  - `pending.snapshot` must not itself contain a `pending` (strip it).
  - While `prompt` is set, `getLegalActions(s, prompt.player)` = one `answer` per unselected option, plus `answer:'done'` when `selected.length >= min`. The other player gets `[]`.
- `draw(player, n)` draws `min(n, deck.length)` and never loses (Review Focus 2).

- [ ] **Step 1: Failing tests** with a test-only script registered in `fixtures.ts`:
  - "Pick 2 of hand then discard them": legal actions are 1 per card, no `done` until 2 are selected; after 2 answers both cards are in the discard pile, `prompt === null` and `pending === null`;
  - "Up to 2" (`min 0`): `done` is legal immediately and finishes with nothing chosen;
  - a coin flip before a choice gives the same result after replay (seeded via the snapshot RNG);
  - a state with a pending prompt survives a JSON round-trip and can still be answered;
  - **(Review Focus 2)** `draw(me, 6)` with 3 cards in deck → hand +3, deck 0, `result === null`.
- [ ] **Step 2:** Run, expect FAIL. **Step 3:** Implement. **Step 4:** Run, expect PASS (Task 3–4 tests too).
- [ ] **Step 5:** Commit `feat(engine): effect context with replayable prompts`.

### Task 6: Attacks, damage, Knockouts, Prizes, win conditions

**Files:**
- Create: `packages/engine/src/combat.ts`, `packages/engine/test/combat.test.ts`

**Interfaces:**
- Consumes: `runEffect`, `canPayCost`, `CardScript.attacks`, `modifyOutgoingDamage`, `modifyIncomingDamage`, `modifyPrizes`, `afterDamagedInActive`.
- Produces: `dealAttackDamage(ctx, target: SlotRef, base: number)` (used by attack effects that hit the Bench too; Bench damage skips W/R), and `checkKnockouts(state): GameState` (runs after every action).
- Attack legality: not the first player's turn 1, cost payable, not Asleep or Paralyzed, `cantAttackOnTurn !== turn`, and `script.attacks[i].canUse?.()` holds.
- Damage pipeline to the opponent's Active: base (`script.damage?(ctx)` else `def.damage`) → `+ Σ modifyOutgoingDamage` (attacker side) → ×2 if the defender's weakness ∈ attacker types → −30 if resistance matches → `+ Σ modifyIncomingDamage` (defender side) → floor 0.
- Order: apply damage, then the attack `effect`, then `afterDamagedInActive` (defender's Tool), then Knockouts, then the turn ends.
- A Knockout moves the whole slot (stack, Energy, Tool) to the discard pile. The opponent takes Prizes `isMega ? 3 : isEx ? 2 : 1`, adjusted by `modifyPrizes` (min 0). If the owner has a Bench, a `system:'promote'` prompt follows. Taking all Prizes wins, and so does the opponent having no Pokémon in play. Both at once → `draw`.
- Confused attackers: in Task 7.

- [ ] **Step 1: Failing tests** (`miniRegistry` plus test types/scripts):
  - 20 base vs Darkness weakness from a Fighting attacker → 40;
  - with Fighting resistance → 0 floor (20 − 30);
  - modifier order: outgoing +120 and incoming −30 with weakness → `(20+120)*2−30 = 250`;
  - a Knockout of a non-ex gives 1 prize, of an ex 2, of a Mega ex 3;
  - a `modifyPrizes` returning `prizes - 1` turns 2 into 1;
  - Knocking Out the last Pokémon in play wins with `reason 'noPokemon'`; taking the last prize wins with `reason 'prizes'`;
  - after a Knockout with a Bench, the owner is prompted to promote and the turn passes after promotion;
  - the first player cannot attack on turn 1, the second player can on turn 2.
- [ ] **Step 2:** Run, expect FAIL. **Step 3:** Implement. **Step 4:** Run, expect PASS.
- [ ] **Step 5:** Commit `feat(engine): attacks, damage pipeline, knockouts, prizes, win conditions`.

### Task 7: Special conditions and Pokémon Checkup

**Files:**
- Create: `packages/engine/src/conditions.ts`, `packages/engine/test/conditions.test.ts`
- Modify: `packages/engine/src/turn.ts` (call `pokemonCheckup` in `endTurn`), `packages/engine/src/combat.ts` (Confusion)

**Interfaces:**
- Produces: `applyCondition(slot, c: 'asleep'|'confused'|'paralyzed'|'poisoned'|'burned')`, where the three rotation conditions replace each other, and `pokemonCheckup(state): GameState`.
- Checkup order for both Actives: Poisoned +10 damage → Burned +20 damage, then flip (heads cures) → Asleep flip (heads wakes) → Paralyzed is cured if the Pokémon's owner just ended their turn → Knockouts. A Confused attacker flips: tails puts 3 damage counters on itself and the attack does nothing.
- No M1 card inflicts conditions; tests use a fixture attack that does.

- [ ] **Step 1: Failing tests:** Poison deals 10 at the checkup; Burn deals 20 then flips; Asleep blocks attack and retreat; Paralyzed blocks attack and retreat and is cured at the end of its owner's next turn; Confused tails → 30 self-damage and no damage dealt; evolving or retreating clears all conditions; a checkup Knockout gives prizes.
- [ ] **Step 2:** Run, expect FAIL. **Step 3:** Implement. **Step 4:** Run, expect PASS.
- [ ] **Step 5:** Commit `feat(engine): special conditions and checkup`.

### Task 8: Trainer rules + Item scripts

**Files:**
- Create: `packages/engine/src/trainers.ts`, `packages/engine/test/trainers.test.ts`, `packages/cards/src/registry.ts`, `packages/cards/src/scripts/{sv01/181,me01/167,me01/131,me01/125,me01/173,me01/130,me01/121,me02/094}.ts` (Nest Ball, Buddy-Buddy Poffin, Ultra Ball, Rare Candy, Night Stretcher, Switch, Mega Signal, Wondrous Patch), `packages/cards/test/items.test.ts`

**Interfaces:**
- Produces: `buildRegistry(): CardRegistry` (cards.json + every script, keyed by def id). Scripts are keyed by **name** for reprints: the registry maps every def id whose name matches a scripted name.
- Rules: a card can be played if `trainer.canPlay(ctx)` is true (default true). Supporter: once per turn, not on the first player's turn 1. Stadium: can't play one with the same name as the one in play; it replaces the existing Stadium (old one to its owner's discard). Tool: one per Pokémon, attached via `playTrainer.target`. A played Item or Supporter goes to the discard pile after resolving.
- Script behaviours (from card text; the tests assert them):
  - Nest Ball: `canPlay` needs Bench < 5. Search the deck for a Basic → Bench; shuffle.
  - Poffin: up to `min(2, free slots)` Basics with HP ≤ 70.
  - Ultra Ball: `canPlay` needs ≥ 2 other cards in hand. Discard 2 (choose), search any Pokémon → hand; shuffle.
  - Rare Candy: `canPlay` needs a Basic in play (`enteredTurn < turn`, not the player's first turn) with a Stage 2 in hand whose `evolvesFrom` names a Stage 1 that evolves from that Basic. Name lookup via the registry: the Stage 2's `evolvesFrom` def has `evolvesFrom === basic.name`.
  - Night Stretcher: `canPlay` needs a Pokémon or Basic Energy in the discard pile. Choose 1 → hand.
  - Switch: `canPlay` needs Bench ≥ 1. Choose a Benched Pokémon and swap it with the Active.
  - Mega Signal: search the deck for a Mega Pokémon ex → hand; shuffle.
  - Wondrous Patch: `canPlay` needs a Basic Psychic Energy in the discard pile and a Benched Psychic Pokémon. Attach it.

- [ ] **Step 1: Failing tests:** one per Item behaviour above, plus **(Review Focus 1, 3)**:
  - Nest Ball is not legal with a full Bench;
  - Poffin with 4 Benched offers max 1;
  - Ultra Ball is not legal with 1 other card in hand;
  - Switch is not legal with an empty Bench;
  - Rare Candy is not legal without a matching Stage 2, or on the player's first turn;
  - Wondrous Patch is not legal with no Psychic Energy in the discard pile;
  - Nest Ball with no Basics left in the deck is playable, finds nothing, and the deck is still shuffled;
  - a Supporter on the first player's turn 1 is not legal;
  - two Supporters in one turn are not legal;
  - playing a Stadium replaces the opponent's; the same name is not legal;
  - a second Tool on the same Pokémon is not legal.
- [ ] **Step 2:** Run, expect FAIL. **Step 3:** Implement. **Step 4:** Run, expect PASS.
- [ ] **Step 5:** Commit `feat: trainer rules and Item card scripts`.

### Task 9: Supporter, Stadium and Tool scripts

**Files:**
- Create: `packages/cards/src/scripts/{me01/119,sv01/166,me01/114,sv02/185,sv09/155,me01/132,me01/122,me01/127,me01/166,me02/092}.ts`, `packages/cards/test/supporters-stadiums-tools.test.ts`

**Interfaces:**
- Consumes: `EffectCtx`, the hooks `stadium.onBenchFromHand`, `modifyRetreatCost`, `afterDamagedInActive`.
- Behaviours:
  - Lillie's Determination: shuffle the hand into the deck, then draw 6 (8 if exactly 6 prizes left).
  - Arven: search up to 1 Item and up to 1 Tool → hand; shuffle.
  - Boss's Orders: `canPlay` needs the opponent's Bench ≥ 1. Choose one and switch it into the opponent's Active.
  - Iono: each player shuffles their hand and puts it on the bottom of their deck. If anyone put cards there, each player draws once per remaining prize.
  - Professor's Research: discard the hand, draw 7.
  - Wally's Compassion: `canPlay` needs a damaged Mega ex. Heal it fully, then all its Energy → hand.
  - Mystery Garden (`stadium.use`, once per player per turn): discard an Energy from hand, then draw until hand size = number of Psychic Pokémon in play. `canUse` needs an Energy in hand.
  - Risky Ruins (`onBenchFromHand`): when a Basic non-Darkness Pokémon is put onto the Bench from hand during its owner's turn, place 2 counters on it. Bench placement through effects like Nest Ball also counts, because "puts onto their Bench" covers effects.
  - Air Balloon: retreat cost −2.
  - Punk Helmet: if the holder is a Darkness Pokémon in the Active Spot and is damaged by an opponent's attack (even if Knocked Out), place 4 counters on the attacker.
- **Engine hook needed:** `putOnBench` and `playBasic` must call the in-play Stadium's `onBenchFromHand`.

- [ ] **Step 1: Failing tests:** one per behaviour above, plus:
  - Lillie's draws 8 at 6 prizes and 6 at 5 prizes;
  - Iono with both hands empty → nobody draws;
  - Boss's Orders is not legal against an empty Bench;
  - Mystery Garden twice in one turn is not legal;
  - Risky Ruins: Nest Ball fetching a Psychic Basic → 20 damage on it, a Darkness Basic → 0;
  - Air Balloon on a retreat-2 Pokémon → `getRetreatCost === 0`;
  - **(Review Focus 4)** Punk Helmet: the attacker's 40 HP of remaining damage room plus a defender Knocked Out by the same attack → both are Knocked Out, both players take prizes, the defending player promotes first, and if both reach 0 prizes the result is `draw`.
- [ ] **Step 2:** Run, expect FAIL. **Step 3:** Implement. **Step 4:** Run, expect PASS.
- [ ] **Step 5:** Commit `feat(cards): supporter, stadium and tool scripts`.

### Task 10: Mega Gengar ex deck Pokémon scripts

**Files:**
- Create: `packages/cards/src/scripts/me02/{056,067,068,059,062,069}.ts`, `packages/cards/test/gengar-deck.test.ts`
  (Gastly 054 and Haunter 055 have no text; they work from data alone.)

**Interfaces:**
- Consumes: `CardScript` attacks, abilities, `modifyPrizes`, `modifyOutgoingDamage`.
- Behaviours:
  - Mega Gengar ex: *Shadowy Concealment* `modifyPrizes` — if the Knocked Out Pokémon is Darkness, owned by the ability holder's side, and was Knocked Out by an attack from an opponent's ex → −1 (no stacking: apply once if any Mega Gengar ex is in play on that side). *Void Gale* 230, then move 1 Energy from self to a chosen Benched Pokémon (skip if no Bench).
  - Toxel: *Call for Family* up to `min(2, free slots)` Basics → Bench; shuffle. *Playful Kick* 20 (data only).
  - Toxtricity: *Sinister Surge* (once per turn) — search for a Basic Darkness Energy, attach it to a Benched Darkness Pokémon, place 2 counters there. `canUse` needs a Benched Darkness Pokémon.
  - Sableye: *Cocky Claw* 20, +70 if any Benched Stage 2 Darkness Pokémon.
  - Seviper: *Excited Power* `modifyOutgoingDamage` +120 to the Active when its side has a Darkness Mega ex in play and the attacker is this Seviper.
  - Eternatus: *Shatter* 50 + discard the Stadium in play. *Power Rush* 130, coin flip; tails → `cantAttackOnTurn = turn + 2`.

- [ ] **Step 1: Failing tests:**
  - one per behaviour, including Shadowy Concealment: an ex attacker Knocking Out a Darkness non-ex with Gengar in play → 0 prizes, Knocking Out Mega Gengar ex itself → 2;
  - two Gengars in play still give −1;
  - Call for Family with 4 Benched brings max 1;
  - Toxtricity's ability is not legal twice in a turn;
  - Eternatus tails → no attack actions on its owner's next turn.
- [ ] **Step 2:** Run, expect FAIL. **Step 3:** Implement. **Step 4:** Run, expect PASS.
- [ ] **Step 5:** Commit `feat(cards): Mega Gengar ex deck Pokémon`.

### Task 11: Mega Diancie ex deck Pokémon scripts

**Files:**
- Create: `packages/cards/src/scripts/{me02/041,me02/040,me01/062,me01/063,me02/043,me02/044,me02/042,me02/039,me02/045}.ts`, `packages/cards/test/diancie-deck.test.ts`

**Interfaces:**
- Consumes: `CardScript` attacks, `modifyIncomingDamage`, `onEvolveFromHand`.
- Behaviours:
  - Mega Diancie ex: *Diamond Coat* −30 incoming (after W/R). *Garland Ray* discard up to 2 Energy cards from self, damage = 120 × number discarded.
  - Meloetta: *Soothing Melody* heal 120 from a Benched Psychic Pokémon. *Magical Shot* 50.
  - Spoink: *Triple Spin* 3 flips × 10.
  - Grumpig: *Energized Steps* (`onEvolveFromHand`, optional yes/no prompt) — look at the top 4 cards, attach any number of Basic Energy among them to your Pokémon one at a time (choose energy, then choose target, `done` to stop), shuffle the rest back.
  - Milcery: *Draining Kiss* 10 + heal 10 from self.
  - Alcremie: *Sweet Circle* 20 × own Pokémon in play.
  - Mimikyu: *Call for Family* 1 Basic → Bench (not legal… playable with a full Bench but finds nothing).
  - Cresselia: *Swelling Light* attach up to 2 Basic Psychic Energy from the deck to self; shuffle.
  - Zacian: *Limit Break* 50, +90 if the opponent has ≤ 3 prizes left.
- **Engine hook needed:** `evolve` from hand calls `onEvolveFromHand` through `runEffect` with source `{kind:'ability', …}`.

- [ ] **Step 1: Failing tests:** one per behaviour, including:
  - Garland Ray discarding 0 does 0, discarding 2 does 240;
  - Diamond Coat: a 40-damage attack ×2 weakness → 50 taken;
  - Grumpig with 2 Energy in the top 4 → both attachable, and the other 2 cards go back into the deck (deck count unchanged except attached);
  - Alcremie with 4 Pokémon in play → 80;
  - Zacian vs 3 prizes → 140, vs 4 → 50.
- [ ] **Step 2:** Run, expect FAIL. **Step 3:** Implement. **Step 4:** Run, expect PASS.
- [ ] **Step 5:** Commit `feat(cards): Mega Diancie ex deck Pokémon`.

### Task 12: Hidden information — viewFor

**Files:**
- Create: `packages/engine/src/view.ts`, `packages/engine/test/view.test.ts`

**Interfaces:**
- Produces: `PlayerView = { me: PlayerId; turn; current; phase; stadium; result; log; prompt: Prompt | null /* only if prompt.player === me */; waitingOn: PlayerId | null; you: { hand: CardInstance[]; deckCount; discard: CardInstance[]; prizeCount; active; bench; …turn flags }; opponent: { handCount; deckCount; discard; prizeCount; active; bench } }`. The slots are the same shape as `PokemonSlot`, with uids resolved to `CardInstance`.
- Never includes: the opponent's hand contents, either deck's order or contents, prize identities, `rng`, `pending`. During the setup phase, the opponent's Active and Bench are hidden (`null` / `[]`).

- [ ] **Step 1: Failing tests:**
  - `JSON.stringify(viewFor(s, 0))` contains none of player 1's hand uids, deck uids or prize uids, and no `"rng"` or `"pending"` key;
  - player 1's view during player 0's prompt has `prompt === null` and `waitingOn === 0`;
  - during setup the opponent's Active is hidden.
- [ ] **Step 2:** Run, expect FAIL. **Step 3:** Implement. **Step 4:** Run, expect PASS.
- [ ] **Step 5:** Commit `feat(engine): per-player views with hidden information`.

### Task 13: Easy bot, match runner, fuzz tests, demo

**Files:**
- Create: `packages/bots/src/{easy.ts,runMatch.ts,demo.ts,index.ts}`, `packages/bots/test/{easy,fuzz}.test.ts`, `packages/engine/README.md`

**Interfaces:**
- Consumes: `Engine`, `PlayerView`, `Action`, `buildRegistry`, decklists.
- Produces:
  - `type Bot = (view: PlayerView, legal: Action[], rng: number) => { action: Action; rng: number }`.
  - `easyBot: Bot`.
  - `runMatch(o: { engine: Engine; decks: [DeckList, DeckList]; seed: number; bots: [Bot, Bot]; maxActions?: number /* default 3000 */ }): { result: GameState['result']; turns: number; actions: number; final: GameState; violations: string[] }`.
- Easy bot priority (first match wins; ties are broken by the RNG):
  1. answer prompts (setup: the highest-HP Basic as Active and all Basics to the Bench; promote: the slot with the most Energy; otherwise a random legal answer, `done` once min is met);
  2. attack if a Knockout is possible;
  3. evolve;
  4. play Supporters/Items that draw or search;
  5. attach Energy to the Active if it can't yet pay its highest-damage attack, else to the Bench Pokémon closest to paying one;
  6. play Basics;
  7. use abilities;
  8. attack for the most base damage;
  9. `endTurn`.
  - It never picks `concede`.
- `runMatch` asks the bot whose turn it is (or the prompt player) each step, runs `checkInvariants` after every action, and stops at a result or `maxActions`.
- Demo: `pnpm --filter @ptcg/bots demo -- --seed 7` prints the game log and the result.

- [ ] **Step 1: Failing tests:**
  - `easy.test.ts`: given a view where an attack Knocks Out, the bot picks that attack; with a pending prompt it only returns `answer` actions;
  - `fuzz.test.ts`: for seeds 1..500, Gengar vs Diancie with sides alternated by seed parity, `result !== null` (finished within maxActions), `violations` is empty, and both decks win at least once over the run. On failure, print the seed.
- [ ] **Step 2:** Run, expect FAIL. **Step 3:** Implement. **Step 4:** Run `pnpm test`, expect all PASS. Run the demo, expect a readable game ending with a winner.
- [ ] **Step 5:** Write `packages/engine/README.md`: the API overview, the replay model and the known simplifications from Global Constraints.
- [ ] **Step 6:** Commit `feat(bots): easy bot, match runner, fuzz tests, demo`. Push the branch and confirm CI is green.
