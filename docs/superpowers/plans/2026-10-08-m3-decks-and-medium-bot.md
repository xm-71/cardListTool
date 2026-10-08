# M3 — Third Deck, Deck Picker, Medium Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Mega Lucario ex League Battle Deck (the engine features it needs and all of its cards), let players pick any deck for either side, and add a Medium bot that clearly beats Easy.

**Architecture:**

- New engine features are generic hooks and data, not card special-cases:
  - per-attack locks;
  - self-damage and an "ignore Weakness/Resistance" option on attack damage;
  - "this turn" lingering effects;
  - modifiers for attack cost and max HP;
  - per-player memory of last turn's Knockouts;
  - Ability limits by name.
- Lucario cards are scripts like M1's.
- The Medium bot rebuilds a full game state from its `PlayerView` plus both decklists, filling hidden cards with random guesses. For each candidate move it plays the rest of its turn with the Easy policy and scores the result. It averages the scores over several guesses and picks the best move.

**Tech Stack:** as M1/M2.

**Spec:** `docs/superpowers/specs/2026-10-08-pokemon-tcg-browser-game-design.md` (§2 M3, §3, §4.1, §4.3, §4.5).

**Scope decision (owner deferred to the recommendation):** M3 adds the Mega Lucario ex League Battle Deck. The Mega Greninja ex League Battle Deck is added after its November 13, 2026 release, once its list is confirmed.

## Global Constraints

- Everything in M1/M2's Global Constraints still holds: seeded randomness, JSON state, UI renders only from `PlayerView`, and only offers legal moves.
- Lucario decklist (TCGdex ids):
  - Pokémon: me01-077 Mega Lucario ex ×3, me01-076 Riolu ×4, me01-073 Hariyama ×2, me01-072 Makuhita ×3, me01-075 Solrock ×2, me01-074 Lunatone ×2, sv06.5-038 Fezandipiti ex ×1, sv06-141 Bloodmoon Ursaluna ex ×1.
  - Trainers: me01-116 Fighting Gong ×4, me01-119 Lillie's Determination ×4, sv09-149 Iris's Fighting Spirit ×3, me01-114 Boss's Orders ×2, sv08-187 Surfer ×1, sv08-177 Gravity Mountain ×2, me01-124 Premium Power Pro ×4, me01-131 Ultra Ball ×4, me01-173 Night Stretcher ×2, sv06-163 Secret Box ×1, me01-130 Switch ×1, me01-166 Air Balloon ×2.
  - Energy: mee-006 Fighting Energy ×12.
  - Total 60.
- Medium bot budget: at most ~250 ms per decision in the browser (in the worker). Default 4 guessed states per decision.
- Medium bot strength target: wins ≥ 60% of 100 seeded mirror-seat games against Easy, across deck pairings.

## Review Focus

1. **Per-attack locks after the Pokémon moves.** "Can't use Mega Brave next turn" must end when the Pokémon leaves the Active Spot or evolves, the same as M1's `cantAttackOnTurn` fix. _(Task 2.)_
2. **Gravity Mountain Knockouts.** Playing it can drop a damaged Stage 2's remaining HP to 0. Expected: an immediate Knockout with Prizes taken, the same as any other Knockout. _(Task 3.)_
3. **"This turn" effects expiring.** Premium Power Pro's +30 must not carry into the next turn or apply to the opponent's attacks. _(Task 2.)_
4. **The Medium bot never stalls or cheats.** Building a guessed state from the view must not use hidden information (the bot only gets `PlayerView` and the decklists). A bot that throws must fall back to the Easy move. _(Task 6.)_
5. **Deck picker:** any deck vs any deck, including mirror matches, in both bot and hotseat modes. _(Task 7.)_

---

### Task 1: Rule fixes deferred from M1

**Files:** `packages/engine/src/{trainers.ts,combat.ts,actions.ts,setup.ts,types.ts}`, `packages/cards/src/scripts/{me01/121,me01/131,sv01/166}.ts`, tests in `packages/engine/test/rules-m3.test.ts`

**Changes:**

- **Stadiums:** at most one Stadium played per turn (`PlayerState.stadiumPlayedTurn`).
- **Checkup Knockouts:** a Knockout during Pokémon Checkup isn't "by an attack". Clear the attack info before `endTurn` inside `attack()`.
- **Action matching:** legality compares actions structurally, ignoring key order. Use a canonical JSON with sorted keys.
- **Concede:** legal for either player at any time before the game ends, including during prompts and the opponent's turn.
- **Mutual mulligans:** each player draws `max(0, opponentMulligans − ownMulligans)` bonus cards. When both players mulligan, the simultaneous mulligans give no bonus.
- **Reveals:** cards that say "reveal" (Mega Signal, Ultra Ball, Arven, and the new Fighting Gong and Secret Box) log the revealed card names via `ctx.reveal(uids)`.

- [ ] **Step 1: Failing tests:**
  - a second Stadium with a different name in the same turn is not legal;
  - a Darkness Pokémon Knocked Out by Poison right after an ex attack gives full Prizes even with Mega Gengar ex in play;
  - an action with re-ordered keys is accepted;
  - `concede` is legal for the waiting player and during a prompt;
  - 2 vs 1 mulligans gives 1 bonus card to the player who mulliganed less, and 0 to the other;
  - Mega Signal logs "Player N reveals Mega Gengar ex".
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `fix(engine): stadium limit, checkup KOs, concede anytime, mulligan bonus, reveals`.

### Task 2: Engine features for the Lucario deck

**Files:** `packages/engine/src/{types.ts,cards.ts,combat.ts,effects.ts,actions.ts,view.ts,state.ts}`, `packages/engine/test/features-m3.test.ts`

**Interfaces:**

- **Per-attack locks.** `PokemonSlot.attackLocks: Record<string, number>` maps attack name → the turn on which it can't be used. Set it with `ctx.lockAttack(ref, name)` (locks for the owner's next turn). It is cleared on retreat, switch and evolve, like `cantAttackOnTurn`.
- **Damage options.** `dealAttackDamage(ctx, target, base, opts?: { ignoreWeaknessResistance?: boolean })` and `ctx.damageSelf(amount)`.
  - Attack scripts may return `{ damage, ignoreWR }`: `AttackScript.damage?(ctx): number | { amount: number; ignoreWR: boolean }`.
- **Knockout memory.** `PlayerState.lastKnockedOutTurn: number | null` is set when one of that player's Pokémon is Knocked Out. Helper `ctx.wasKnockedOutLastOpponentTurn(player)` is true when `lastKnockedOutTurn === turn − 1`.
- **Ability limits by name.** `PlayerState.abilityNamesUsedTurn: Record<string, number>`, used by scripts via `ctx.usedAbilityNameThisTurn(name)` / `ctx.markAbilityName(name)`. This covers "You can't use more than 1 X Ability each turn".
- **Cost hook.** `CardScript.modifyAttackCost?(q: { state; holder: SlotRef; attackIndex: number; cost: EnergyType[]; registry }): EnergyType[]`. It is applied for the attacker's own card.
- **HP hook.** `CardScript.modifyMaxHp?(q: { state; slot: SlotRef; hp: number; registry }): number`. It is applied from the Stadium in play, and the Pokémon's own scripts and Tool. The engine's `maxHp(state, ref, registry)` is used everywhere HP matters (Knockouts, view).
- **Lingering effects.** `GameState.lingering: { defId: string; owner: PlayerId; turn: number }[]`, added by `ctx.addLingering(defId)`. While `turn === state.turn`, that card's `modifyOutgoingDamage` hook (and future hooks) applies as if it were in play for its owner.
- **View.** `SlotView.hp` holds the effective max HP. The web UI uses it.

- [ ] **Step 1: Failing tests** (with fixture scripts):
  - a locked attack is not offered next turn and is offered again after a retreat;
  - self-damage Knocks Out the attacker and gives the opponent Prizes;
  - an ignore-W/R attack does its printed damage into Weakness;
  - a lingering +30 applies this turn only, and only to its owner's attacks;
  - a cost modifier removing one Colorless makes an attack legal with one fewer Energy;
  - a Stadium `modifyMaxHp` −30 Knocks Out a Stage 2 with 30 HP left as soon as the Stadium is played;
  - the `lastKnockedOutTurn` helper is true only during the next turn of that player.
- [ ] **Step 2–4:** FAIL → implement → PASS (fuzz test still green). **Step 5:** Commit `feat(engine): attack locks, self damage, lingering effects, cost/HP hooks`.

### Task 3: Lucario deck data and Trainer scripts

**Files:** `packages/cards/src/decks/mega-lucario.json`, `src/data/cards.json` (regenerated), scripts for `me01/116` Fighting Gong, `sv08/177` Gravity Mountain, `sv09/149` Iris's Fighting Spirit, `me01/124` Premium Power Pro, `sv06/163` Secret Box, `sv08/187` Surfer, tests in `packages/cards/test/lucario-trainers.test.ts`

**Behaviours:**

- **Fighting Gong:** search the deck for a Basic Fighting Energy or Basic Fighting Pokémon → hand (revealed); shuffle.
- **Gravity Mountain:** `modifyMaxHp` gives −30 to Stage 2 Pokémon (both sides).
- **Iris's Fighting Spirit:** `canPlay` needs another card in hand. Discard 1 card, then draw until 6 in hand.
- **Premium Power Pro:** `addLingering`. Its `modifyOutgoingDamage` gives +30 when the attacker is the holder's Fighting Pokémon and the target is the opponent's Active.
- **Secret Box** (ACE SPEC): `canPlay` needs 3 other cards in hand. Discard 3, then search up to one each of Item, Tool, Supporter and Stadium → hand (revealed); shuffle.
- **Surfer:** if there is a Bench, switch, then draw until 5 in hand. With no Bench nothing happens; it is still playable.

- [ ] **Step 1: Failing tests:**
  - one per behaviour;
  - the deck totals 60;
  - **(RF2)** Gravity Mountain played onto a Stage 2 with ≤ 30 HP left Knocks it Out and gives Prizes;
  - **(RF3)** Premium Power Pro's bonus is gone on the next turn.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat(cards): Mega Lucario ex deck data and Trainers`.

### Task 4: Lucario deck Pokémon scripts

**Files:** scripts for `me01/077` Mega Lucario ex, `me01/076` Riolu, `me01/073` Hariyama, `me01/075` Solrock, `me01/074` Lunatone, `sv06.5/038` Fezandipiti ex, `sv06/141` Bloodmoon Ursaluna ex; test `packages/cards/test/lucario-deck.test.ts`

**Behaviours:**

- **Mega Lucario ex:**
  - Aura Jab: attach up to 3 Basic Fighting Energy from the discard pile to Benched Pokémon, one at a time.
  - Mega Brave: lock "Mega Brave" for the owner's next turn.
- **Riolu:** Accelerating Stab locks itself for the next turn.
- **Hariyama:**
  - Heave-Ho Catcher: optional on evolve from hand. If the opponent has a Bench, gust one of their Benched Pokémon into the Active Spot.
  - Wild Press: 210, and 70 damage to itself.
- **Solrock:** Cosmic Beam does 70 only if Lunatone is on your Bench (else 0), ignoring Weakness/Resistance.
- **Lunatone:** Lunar Cycle, an activated Ability. It needs Solrock in play, a Basic Fighting Energy in hand, and no other Lunar Cycle used this turn. Discard the Energy, draw 3.
- **Fezandipiti ex:**
  - Flip the Script: needs one of your Pokémon Knocked Out during the opponent's last turn, and no Flip the Script used this turn. Draw 3.
  - Cruel Arrow: choose any opponent's Pokémon and do 100 (no W/R for Benched Pokémon).
- **Bloodmoon Ursaluna ex:**
  - Seasoned Skill: Blood Moon costs one less Colorless per Prize the opponent has taken.
  - Blood Moon: 240, and the Pokémon can't attack next turn.

- [ ] **Step 1: Failing tests:**
  - one per behaviour above;
  - **(RF1)** Mega Brave locked, then switched out and back → usable.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat(cards): Mega Lucario ex deck Pokémon`.

### Task 5: Three-deck fuzz

**Files:** `packages/bots/test/fuzz.test.ts`

- [ ] **Step 1:** Extend the fuzz to every ordered pairing of the 3 decks, including mirrors (9 pairings × `FUZZ_GAMES/9` seeds). There must be no violations and every game must finish. Every deck wins at least once.
- [ ] **Step 2:** Run with the full count. Fix any engine or script bug found (each with a regression test). Commit `test(bots): fuzz all deck pairings`.

### Task 6: Medium bot

**Files:** `packages/bots/src/{determinize.ts,evaluate.ts,medium.ts}`, tests `packages/bots/test/{determinize,medium}.test.ts`

**Interfaces:**

- `determinize(view: PlayerView, decks: [DeckList, DeckList], registry, rng): { state: GameState; rng }` builds a full `GameState` consistent with `view`:
  - Visible cards keep their uids and places.
  - Each player's unknown cards are their decklist minus every visible card of theirs. They are shuffled into the hidden zones (deck, prizes, the opponent's hand) at the view's counts, with fresh uids `p{n}-h{k}`.
  - `pending` is null and `prompt` is `view.prompt`.
- `evaluate(state, me, registry): number` adds up:
  - 100 × (my Prizes taken − theirs);
  - 25 × each Knocked Out opposing Pokémon this turn (via Prizes);
  - +0.5 × damage on the opponent's Active, +0.2 × damage on their Bench, −0.3 × damage on my Pokémon;
  - +6 per Energy on my Pokémon that can use an attack, +3 per other Energy;
  - +4 per my Benched Pokémon;
  - +1 per card in hand (capped at 8);
  - a 100000 bonus for a win and −100000 for a loss.
- `createMediumBot(registry, decks: [DeckList, DeckList], seat: PlayerId, samples = 4): Bot`:
  - **For each legal action (main phase):** across `samples` guessed states, apply the action. Then continue with the Easy policy for my own actions and prompts until the turn passes to the opponent or the game ends (at most 40 steps). Evaluate, average, and pick the best (ties are broken by the RNG).
  - **Prompts** (no pending effect is available in a guessed state): use Easy's prompt answers, except promotion, which picks the Benched Pokémon with the highest `evaluate` after a simulated promotion.
  - **Concede** is never chosen, and `endTurn` is always a candidate.
  - **Any exception** during simulation falls back to the Easy bot's move. (RF4)

- [ ] **Step 1: Failing tests:**
  - **(RF4)** `determinize` reproduces every visible card exactly, the per-player card counts total 60, and with the same view and rng it returns the same state;
  - `determinize` never includes the opponent's real hidden uids;
  - with a Knockout available the Medium bot attacks;
  - `medium.test`: over 100 seeded games across deck pairings with alternating seats, Medium beats Easy ≥ 60%;
  - the average decision time is under 250 ms. Skip this check in CI if `CI_SLOW=1`, but keep the win-rate test.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat(bots): medium bot with determinized rollouts`.

### Task 7: Deck picker, difficulty and web integration

**Files:** `apps/web/src/game/catalog.ts` (3 decks), `store.ts` (`GameConfig.difficulty: 'easy' | 'medium'`, `seat0Deck`/`seat1Deck`), `botClient.ts` + `bot.worker.ts` (the bot is built per game config: difficulty + decks + seat), `screens/Home.tsx` (opponent: Easy bot / Medium bot / Hotseat; pick a deck for each side, including the same deck), `ui/SlotView.tsx` (uses `slot.hp`), tests in `apps/web/test/picker.test.tsx`, e2e update

- [ ] **Step 1: Failing tests:**
  - **(RF5)** Home offers 3 decks per side, and starting with Lucario vs Lucario creates a mirror game;
  - choosing Medium sends `difficulty: 'medium'` to the bot client;
  - SlotView shows Gravity Mountain's reduced HP.
- [ ] **Step 2–4:** FAIL → implement → PASS, plus the Playwright smoke test against the Medium bot. **Step 5:** Commit `feat(web): deck picker for both sides and bot difficulty`.

### Task 8: Ship

- [ ] Whole-branch review by a fresh reviewer, then the fix pass (each fix test-first).
- [ ] Open a PR into `master`, wait for CI green, merge, and check the Vercel production deployment.
