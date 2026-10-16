# Smart bots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Medium and Hard bots answer card choices sensibly, play Trainers in a sensible order, retreat, see scripted
damage and plan Prizes, within today's thinking budget; Easy is unchanged.

**Architecture:** A rule-based smart policy (`smart.ts`) built on a per-deck plan (`plan.ts`) and card roles
(`roles.ts`) replaces Easy inside Medium and Hard (prompt answers and turn rollouts). `evaluate` gains a sandbox damage
estimate (`damage.ts`), a Prize map and setup terms. Today's Hard stays reachable through `HardOptions.legacy` for the
strength comparison only.

**Tech Stack:** TypeScript, vitest, `@ptcg/engine` (+ `@ptcg/engine/testing` fixtures in tests), `@ptcg/cards`.

**Spec:** `docs/superpowers/specs/2026-10-15-smart-bots-design.md`

## Global Constraints

- No changes to `packages/engine`, `packages/cards` or `apps/web`. All work is in `packages/bots`.
- Easy is byte-for-byte unchanged: `src/easy.ts` and `test/easy.test.ts` are not edited.
- Hard keeps `budgetMs` default 1500 and `maxRounds` default 16; 95% of Hard decisions take at most 2 s.
- New Hard beats legacy Hard in at least 60% of games over every ordered pair of the 15 premade decks.
- `createMediumBot(registry, decks, seat, samples?)` and `createHardBot(registry, decks, seat, options?)` keep their
  signatures (the app calls them unchanged).
- Prize values come from `standard2026.prizeValue` (1, ex 2, Mega 3); never hard-code them.
- Every bot answer must be one of the `legal` actions passed in.
- Spec says `createSmartBot(registry, deck)`; this plan uses `createSmartBot(registry, decks, damage?)` because the
  policy plays both seats inside rollouts and shares the damage cache (same behaviour, one plan per seat).

## Review Focus

1. A "choose up to N" prompt (min 0, a `done` option, max > 1): the smart policy picks useful cards then answers
   `done`; it never loops picking nothing. → Task 4 test `stops with done when nothing useful is left`.
2. A prompt whose every option the heuristics would avoid (e.g. a forced discard of protected cards): it still answers
   a legal option. → Task 4 test `answers a forced choice even when every option is protected`.
3. A deck with no attacking Pokémon or no evolution lines: `deckPlan` returns empty lists, nothing throws. → Task 2
   test `a deck with no attacks gives an empty attacker list`.
4. An attack whose effect pauses on a prompt (e.g. "discard up to 2 Energy"): the sandbox falls back to printed damage
   instead of throwing. → Task 3 test `an attack that pauses on a prompt falls back to printed damage`.
5. Whole games with the smart policy on every premade and gym deck finish without stalls or violations, including the
   setup phase. → Task 5 test `smart vs easy plays every premade deck to the end`, plus the fuzz runs in Task 8.

---

### Task 1: Card roles

**Files:**
- Create: `packages/bots/src/roles.ts`
- Test: `packages/bots/test/roles.test.ts`

**Interfaces:**
- Produces: `type TrainerRole = 'gust' | 'switch' | 'draw' | 'search' | 'evolve' | 'other'`;
  `trainerRole(def: TrainerDef): TrainerRole`; `isSupportPokemon(def: PokemonDef): boolean` (has an Ability whose
  text matches `/draw|search your deck|look at the top/i`).

- [ ] **Step 1: Write the failing test** `test/roles.test.ts` with the real registry (`buildRegistry()`):

```ts
const role = (id: string) => trainerRole(registry.defs[id] as TrainerDef);
test('classifies staple Trainers', () => {
  expect(['me01-131', 'sv01-181', 'me01-167', 'sv01-166', 'sv10.5b-084', 'me01-173'].map(role)).toEqual(
    Array(6).fill('search'),
  ); // Ultra Ball, Nest Ball, Poffin, Arven, Pokégear, Night Stretcher
  expect(['sv02-185', 'sv09-155', 'me01-119'].map(role)).toEqual(['draw', 'draw', 'draw']); // Iono, Research, Lillie's
  expect(['me01-114', 'sv05-157'].map(role)).toEqual(['gust', 'gust']); // Boss's Orders, Prime Catcher
  expect(role('me01-130')).toBe('switch');
  expect(role('me01-125')).toBe('evolve'); // Rare Candy
});
test('support Pokémon have a draw or search Ability', () => {
  expect(isSupportPokemon(registry.defs['sv06.5-038'] as PokemonDef)).toBe(true); // Fezandipiti ex
  expect(isSupportPokemon(registry.defs['sv06-130'] as PokemonDef)).toBe(false); // Dragapult ex
});
```

- [ ] **Step 2: Run** `pnpm --filter @ptcg/bots exec vitest run test/roles.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement** in `src/roles.ts`, testing the card text in this order: gust
  (`/switch in 1 of your opponent's benched/i`), switch (`/switch your active pok[eé]mon with/i`), evolve (name
  `Rare Candy` or `/stage 2 card in your hand/i`), draw (Supporter and `/\bdraw/i`), search
  (`/search your deck|look at the top|from your discard pile into your hand/i`), else `other`. If Fezandipiti's
  Ability text does not match the support regex, widen the regex (not the test) and note it.

- [ ] **Step 4: Run** the same command — Expected: PASS.

- [ ] **Step 5: Commit** `git add packages/bots/src/roles.ts packages/bots/test/roles.test.ts && git commit -m "Bots: card roles"`

### Task 2: Deck plan

**Files:**
- Create: `packages/bots/src/plan.ts`, `packages/bots/src/plans.ts`
- Test: `packages/bots/test/plan.test.ts`

**Interfaces:**
- Consumes: `isSupportPokemon` (Task 1).
- Produces:
  ```ts
  interface DeckPlan {
    /** Card names of the main attackers (1–2), best first. */
    attackers: string[];
    /** Each final-stage name → its line from Basic to final, by name (e.g. ['Dreepy','Drakloak','Dragapult ex']). */
    lines: Record<string, string[]>;
    /** Names of support Pokémon. */
    support: string[];
    /** Names in search priority order (evolution pieces of attacker lines, attacker Basics, support, then the rest). */
    priority: string[];
  }
  deckPlan(deck: DeckList, registry: CardRegistry): DeckPlan
  DECK_PLANS: Record<string, Partial<Pick<DeckPlan, 'attackers' | 'support'>> & { first?: string[] }>
  ```
  `deckPlan` applies `DECK_PLANS[deck.name]` when present: `attackers`/`support` replace the computed ones, `first`
  names go to the front of `priority`. `DECK_PLANS` starts empty (`{}`).

- [ ] **Step 1: Write the failing test** `test/plan.test.ts` (real registry and decks from `@ptcg/cards`):

```ts
test('Johto Lance has the Dragonite and Charizard ex lines', () => {
  const p = deckPlan(GYM_DECKS['johto-lance'], registry);
  expect(p.lines['Dragonite']).toEqual(['Dratini', 'Dragonair', 'Dragonite']);
  expect(p.lines['Charizard ex']).toEqual(['Charmander', 'Charmeleon', 'Charizard ex']);
  expect(p.attackers.length).toBeGreaterThanOrEqual(1);
  expect(p.attackers.length).toBeLessThanOrEqual(2);
});
test('Dragapult and Crustle', () => {
  const d = deckPlan(metaDragapultDeck, registry);
  expect(d.lines['Dragapult ex']).toEqual(['Dreepy', 'Drakloak', 'Dragapult ex']);
  expect(d.attackers).toContain('Dragapult ex');
  expect(deckPlan(metaCrustleDeck, registry).lines['Crustle']).toEqual(['Dwebble', 'Crustle']);
});
test('priority puts a missing evolution piece of an attacker line before support', () => {
  const d = deckPlan(metaDragapultDeck, registry);
  expect(d.support.length).toBeGreaterThan(0);
  expect(d.priority.indexOf('Drakloak')).toBeLessThan(d.priority.indexOf(d.support[0]!));
});
test('an override changes attackers and puts first names first', () => {
  DECK_PLANS['test override'] = { attackers: ['Dragonair'], first: ['Gyarados'] };
  const p = deckPlan({ ...GYM_DECKS['johto-lance'], name: 'test override' }, registry);
  expect(p.attackers).toEqual(['Dragonair']);
  expect(p.priority[0]).toBe('Gyarados');
  delete DECK_PLANS['test override'];
});
test('a deck with no attacks gives an empty attacker list', () => {
  // mini registry: Pokémon with no attacks, no evolutions
  expect(deckPlan(deckOf({ 't-basic-noatk': 20, 't-dark': 40 }), mini).attackers).toEqual([]);
});
```
  (`mini` = `miniRegistry([pokemon('t-basic-noatk', { attacks: [] })])`; `deckOf` from `@ptcg/engine/testing`.)

- [ ] **Step 2: Run** `pnpm --filter @ptcg/bots exec vitest run test/plan.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement** `deckPlan`: lines by walking `evolvesFrom` names down to a Basic in the deck; attacker score
  = best `damage / max(1, cost.length)` over the final stage's attacks (printed damage), top 2 lines with score > 0
  (only the top 1 if the second scores under half the first); support via `isSupportPokemon`; priority = for each
  attacker line, its pieces from Basic up, then support names, then remaining Pokémon names; then `DECK_PLANS`.

- [ ] **Step 4: Run** — Expected: PASS.

- [ ] **Step 5: Commit** `git commit -m "Bots: deck plan"` (src/plan.ts, src/plans.ts, test).

### Task 3: Sandbox damage estimate

**Files:**
- Create: `packages/bots/src/damage.ts`
- Test: `packages/bots/test/damage.test.ts`

**Interfaces:**
- Produces:
  ```ts
  /** Raw damage (before Weakness/Resistance) keyed by `${defId}|${attackIndex}|${energyCount}`. */
  class DamageCache { get(defId: string, attackIndex: number, energy: number): number | undefined; }
  /** Damage the attack of the Pokémon at `attacker` would deal to the other side's Active, with `extraEnergy`
   *  more Energy attached; raw (Weakness/Resistance divided out). Cached; printed damage on any failure. */
  estimateDamage(engine: Engine, state: GameState, attacker: SlotRef, attackIndex: number,
                 cache: DamageCache, extraEnergy?: number): number
  ```

- [ ] **Step 1: Write the failing test** `test/damage.test.ts` with a mini registry (pattern of `test/hard.test.ts`):

```ts
// 'scaler': printed 10, script deals 10 + 50 per attached Energy; 'pauser': printed 30, script opens a prompt.
test('a scaling attack is estimated above its printed damage', () => {
  const { s, ref } = activeWith('scaler', 3); // 3 Energy attached
  expect(estimateDamage(engine, s, ref, 0, new DamageCache())).toBe(160);
});
test('the cache returns the same value without replaying', () => {
  const cache = new DamageCache();
  const { s, ref } = activeWith('scaler', 3);
  estimateDamage(engine, s, ref, 0, cache);
  expect(cache.get('scaler', 0, 3)).toBe(160);
});
test('an attack that pauses on a prompt falls back to printed damage', () => {
  const { s, ref } = activeWith('pauser', 1);
  expect(estimateDamage(engine, s, ref, 0, new DamageCache())).toBe(30);
});
test('the real state is not changed', () => {
  const { s, ref } = activeWith('scaler', 3);
  const before = JSON.stringify(s);
  estimateDamage(engine, s, ref, 0, new DamageCache());
  expect(JSON.stringify(s)).toBe(before);
});
```

- [ ] **Step 2: Run** `pnpm --filter @ptcg/bots exec vitest run test/damage.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement**: `structuredClone` the state; make the attacker's owner current in its main phase with no
  prompt and the attacker Active (swap with Active if Benched); attach `extraEnergy` Basic Energy cards (any Basic
  Energy def in the registry whose type the cost needs, else any); check `engine.getLegalActions` contains the attack;
  apply it; read the defender's damage increase (a Knock Out counts as its remaining HP); if the result has a prompt or
  anything throws, use printed damage. Divide out Weakness (÷2) and add back Resistance (+30) using the defender def.
  Store under the attacker's top defId and attached Energy count before `extraEnergy`.

- [ ] **Step 4: Run** — Expected: PASS.

- [ ] **Step 5: Commit** `git commit -m "Bots: sandbox damage estimate"`.

### Task 4: Smart prompt answers

**Files:**
- Create: `packages/bots/src/smart.ts` (prompt part)
- Test: `packages/bots/test/smart-prompts.test.ts`

**Interfaces:**
- Consumes: `DeckPlan` (Task 2), `DamageCache` (Task 3), `standard2026.prizeValue`.
- Produces: `answerPrompt(view: PlayerView, legal: Action[], plan: DeckPlan, registry: CardRegistry, damage?: DamageCache): Action`
  — returns one of `legal` (all `answer` actions). Damage uses `damage.get(...)` when present, else printed damage,
  with Weakness ×2 and Resistance −30.

- [ ] **Step 1: Write the failing tests** `test/smart-prompts.test.ts`. Build positions with the real registry and
  `@ptcg/engine/testing` helpers (`started`/`finishSetup`, `swapActiveTo`, `benchFromHand`, `giveCard`,
  `attachFromDeck`), take `engine.viewFor(s, me)`, and set `view.prompt` to a hand-made `Prompt` whose options mirror
  the engine's (slot options carry `slot`, card options carry `uid` and `defId`); `legal` = one `answer` per option
  (plus `done` when min is 0). Tests:

  - `gust takes the ex it can Knock Out over a Basic it cannot` — opponent Bench: a damaged ex within reach of the
    bot's Active attack, and a full-HP Basic; prompt "Choose a Pokémon" over the opponent's Bench → the ex's option.
  - `search takes the missing Stage 1 over a fourth Basic` — Dragapult deck, Bench has Dreepy, hand has no Drakloak;
    card prompt with options Dreepy and Drakloak (not in hand) → Drakloak.
  - `discard keeps Rare Candy while a Stage 2 line waits` — hand: Rare Candy, Dragapult ex, 3 Basic Energy, Bench
    Dreepy; discard prompt (options from hand, min 2 max 2) → two answers over the run never pick Rare Candy or
    Dragapult ex (call `answerPrompt` twice, updating `prompt.selected`).
  - `switch brings in the Pokémon that can attack` — own Bench: one with enough Energy, one without → the ready one.
  - `stops with done when nothing useful is left` — "choose up to 2" from deck where only one option is in the plan
    and `selected` already holds it → `done`.
  - `answers a forced choice even when every option is protected` — discard prompt min 1 whose only options are Rare
    Candy and the last attacker → a legal answer.

- [ ] **Step 2: Run** `pnpm --filter @ptcg/bots exec vitest run test/smart-prompts.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement** `answerPrompt` per the spec's card-choice table: classify by `prompt.kind` and options
  (`slot.player !== view.me` → opponent; card options whose `uid` is in `view.you.hand` → discard; other card options
  → take; message `/heal/i` → heal; `option` prompts → Easy's rule except "Use which attack" → best estimated damage).
  Take: pick the highest `plan.priority` name not already on board/in hand (or the first option if none rank), and
  `done` once `selected.length >= min` and no remaining option ranks. Discard: rank by least useful (Energy beyond the
  board's need, duplicates, Basics with no Bench room or plan role), protected cards last.

- [ ] **Step 4: Run** — Expected: PASS.

- [ ] **Step 5: Commit** `git commit -m "Bots: smart prompt answers"`.

### Task 5: Smart turn policy

**Files:**
- Modify: `packages/bots/src/smart.ts` (add the policy)
- Test: `packages/bots/test/smart.test.ts`

**Interfaces:**
- Consumes: `trainerRole` (Task 1), `deckPlan` (Task 2), `answerPrompt` (Task 4), `DamageCache` (Task 3).
- Produces: `createSmartBot(registry: CardRegistry, decks: [DeckList, DeckList], damage?: DamageCache): Bot` — plans
  for both seats built once; uses `view.me`'s plan (it plays either side inside rollouts).

- [ ] **Step 1: Write the failing tests** `test/smart.test.ts` (real positions as in Task 4, `bot(view, legal, rng)`
  with `legal = engine.getLegalActions`):
  - `plays a search Item before a draw Supporter` — hand: Nest Ball, Iono, a Basic for the plan → first action plays
    Nest Ball.
  - `does not play Iono into a hand with plays` — hand: Iono, an evolution that can be played, Energy → the action is
    not playing Iono.
  - `plays Boss's Orders only when it leads to a better Knock Out` — (a) Bench ex in reach, Active not → plays Boss's
    Orders; (b) Active in reach → does not play it.
  - `retreats when the Active cannot attack and a Benched Pokémon can` — Energy already attached this turn, Active
    without Energy, Benched attacker ready, retreat payable → `retreat`.
  - `attaches Energy to the planned attacker` — Active is a support Pokémon that already can't use it; Benched
    attacker short one Energy → `attachEnergy` targeting the Bench attacker.
  - `does not Bench an extra ex the plan does not need` — hand: an off-plan ex Basic, Bench has room → no `playBasic`
    of it.
  - `smart vs easy plays every premade deck to the end` — `runMatch` with `createSmartBot` against Easy, one game per
    deck in the 15 premade decks (both seats alternate) → every result set, `violations` empty.

- [ ] **Step 2: Run** `pnpm --filter @ptcg/bots exec vitest run test/smart.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement** the spec's eight-step turn order. Prompts → `answerPrompt`. Setup-phase prompts keep
  Easy's rule (highest HP Active) except Bench choices follow the plan. Each step filters `legal` by kind and the
  plan; "nothing useful" for a step falls through to the next; the last step attacks (Knock Out first, else most
  estimated damage) or ends the turn. Ties use `nextRandom` as Easy does.

- [ ] **Step 4: Run** — Expected: PASS.

- [ ] **Step 5: Commit** `git commit -m "Bots: smart turn policy"`.

### Task 6: Scoring

**Files:**
- Modify: `packages/bots/src/evaluate.ts`
- Test: `packages/bots/test/evaluate.test.ts`

**Interfaces:**
- Consumes: `estimateDamage`, `DamageCache` (Task 3), `DeckPlan` (Task 2).
- Produces: `evaluate(state, me, registry, ctx?: { engine: Engine; damage: DamageCache; plans: [DeckPlan, DeckPlan] }): number`
  (with `ctx` the new terms apply; without it, today's behaviour) and `evaluateLegacy` = today's function unchanged,
  exported for `HardOptions.legacy`.

- [ ] **Step 1: Write the failing tests** `test/evaluate.test.ts`:
  - `a scaled attack reads as a Knock Out threat` — the Task 3 'scaler' Active with 3 Energy vs a 150-HP opponent
    Active: score with `ctx` exceeds score without by at least 40 × the defender's Prize value.
  - `fewer Knock Outs needed scores higher` — two states equal except the opponent's Benched Basic (1 Prize) is
    replaced by an ex Basic with the same HP and damage: with `ctx`, `me` needs fewer Knock Outs in the ex state, so
    it scores higher for `me`.
  - `an extra off-plan ex on my Bench is a penalty` — adding an ex not in my plan to my Bench lowers my score with
    `ctx`.
  - `legacy is unchanged` — `evaluateLegacy` equals `evaluate` without `ctx` on 20 states from a seeded Easy game.

- [ ] **Step 2: Run** `pnpm --filter @ptcg/bots exec vitest run test/evaluate.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement** with `ctx`: threat checks use `estimateDamage` (opponent `extraEnergy` 1) with
  Weakness/Resistance applied; Prize map = for each side, the fewest Knock Outs (greedy by Prize value over the other
  side's Pokémon in play) to take its remaining Prizes, adding `30 × (opp needed − my needed)`; Benched ex/Mega not in
  my plan's lines or attackers −15 each; next attacker on the Bench with Energy +10; evolution piece for a Benched
  line member in hand +6; hand term counts cards whose name is in my plan's priority (cap 8) instead of hand size.

- [ ] **Step 4: Run** — Expected: PASS, and `pnpm --filter @ptcg/bots exec vitest run test/hard.test.ts test/medium.test.ts` still PASS.

- [ ] **Step 5: Commit** `git commit -m "Bots: scoring with real damage and Prize map"`.

### Task 7: Medium and Hard use the smart policy

**Files:**
- Modify: `packages/bots/src/medium.ts`, `packages/bots/src/hard.ts`, `packages/bots/src/search.ts` (rollout takes a
  `Bot`, already does), `packages/bots/test/hard.test.ts`, `packages/bots/test/medium.test.ts`

**Interfaces:**
- Consumes: `createSmartBot` (Task 5), `answerPrompt` (Task 4), `evaluate` with ctx / `evaluateLegacy` (Task 6).
- Produces: `HardOptions.legacy?: boolean` — when true, Hard behaves exactly as before this plan (Easy rollouts and
  prompts, `evaluateLegacy`). Default false.

- [ ] **Step 1: Write the failing tests**:
  - in `hard.test.ts`: `answers a gust prompt with the Knock Out target` — a position where Hard has played Boss's
    Orders and holds the prompt; the answer is the in-reach ex (legacy picks the first option, which the test sets up
    to be the wrong one).
  - in `hard.test.ts`: `legacy option keeps the old prompt answers` — same position with `legacy: true` → first option.
  - in `medium.test.ts`: `answers a search prompt from its plan` — Medium with the Task 4 search position → Drakloak.

- [ ] **Step 2: Run** `pnpm --filter @ptcg/bots exec vitest run test/hard.test.ts test/medium.test.ts` — Expected: the
  new tests FAIL.

- [ ] **Step 3: Implement**: both bots build one `DamageCache`, plans for both decks and `createSmartBot(registry,
  decks, cache)`; non-promotion prompts → `answerPrompt`; `rolloutTurn` uses the smart bot; `evaluate` gets `ctx`.
  With `legacy`, Hard keeps the Easy bot and `evaluateLegacy` everywhere.

- [ ] **Step 4: Run** `pnpm --filter @ptcg/bots test` — Expected: all PASS, including the existing timing tests in
  `hard.test.ts`. If p95 exceeds 2 s, reduce smart-policy work in rollouts (e.g. skip sandbox calls past the first
  reply turn) — never raise the budget.

- [ ] **Step 5: Commit** `git commit -m "Bots: Medium and Hard play with the smart policy"`.

### Task 8: Strength checks and fuzz

**Files:**
- Modify: `packages/bots/scripts/round-robin.ts` (add `--smart`), `packages/bots/test/fuzz.test.ts`,
  `packages/bots/test/gym-fuzz.test.ts` (only if their Hard runs need the new options; behaviour otherwise unchanged)

**Interfaces:**
- Consumes: `HardOptions.legacy` (Task 7).

- [ ] **Step 1: Add `--smart`** to `round-robin.ts`: for every ordered pair of the 15 `DECKS`, `perPair` games (default
  4) alternating seats, new Hard vs `legacy: true` Hard, both `{ maxRounds: HARD_ROUNDS ?? 8, now: () => 0 }`, honouring
  `HARD_SHARD`; print overall and per-deck new-Hard win rates and `PASS`/`FAIL` against 60%.

- [ ] **Step 2: Run** `pnpm --filter @ptcg/bots test` — Expected: PASS (fuzz and gym-fuzz with no violations).

- [ ] **Step 3: Run** `HARD_SHARD=k/4 npx tsx scripts/round-robin.ts --smart` for k = 0..3 in parallel and sum —
  Expected: new Hard ≥ 60%. If below, tune scoring weights / turn-order rules (record each change in the ledger) and
  rerun; do not lower the bar.

- [ ] **Step 4: Run the gym probe** (the throwaway 2026-10-15 script: each gym deck with its in-game difficulty vs the 6
  meta + 3 Mega decks piloted by legacy Hard, 2 games per opponent, `maxRounds` 8, fake clock) from the scratchpad,
  not committed — Expected: a before/after table per leader for the PR description.

- [ ] **Step 5: Commit** `git commit -m "Bots: --smart strength check"`.
