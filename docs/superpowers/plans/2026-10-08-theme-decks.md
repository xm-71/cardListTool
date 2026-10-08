# Theme Decks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add six playable Mega ex theme decks (Charizard X, Venusaur, Abomasnow, Manectric, Kangaskhan, Lopunny), each with every card scripted and tested, selectable in the Duel picker.

**Architecture:**

- Small engine additions:
  - timed slot markers;
  - a player Stadium lock;
  - `becameActiveTurn`;
  - an attack option that ignores the Defending Pokémon's effects;
  - repeatable Abilities with a per-turn cap.
- One task per deck. Each task adds:
  - the deck's card scripts in `packages/cards/src/scripts/<set>/<num>.ts`, registered in `scripts/index.ts`;
  - a test per card;
  - the deck JSON.
- The web catalog gains a `kind` field so the picker can group decks.

**Tech Stack:** as in the repo. TypeScript engine/cards/bots, React web, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-08-theme-decks-design.md`

## Global Constraints

- **Legality:**
  - every deck card is Standard-legal (regulation mark ≥ H; Basic Energy has no mark);
  - every deck card passes `isPlayable`;
  - every deck passes `validateCustomDeck`'s format rules (60 cards, ≤4 per name, ≥1 Basic, ≤1 ACE SPEC). Ownership is not checked: call it with a collection that owns every card.
- **Shared Trainer core** (25):

  | Card                   | Id       | Count |
  | ---------------------- | -------- | ----- |
  | Lillie's Determination | me01-119 | 4     |
  | Iris's Fighting Spirit | sv09-149 | 2     |
  | Boss's Orders          | me01-114 | 2     |
  | Ultra Ball             | me01-131 | 4     |
  | Buddy-Buddy Poffin     | me01-167 | 3     |
  | Mega Signal            | me01-121 | 2     |
  | Switch                 | me01-130 | 2     |
  | Night Stretcher        | me01-173 | 2     |
  | Wally's Compassion     | me01-132 | 2     |
  | Air Balloon            | me01-166 | 2     |

  Stage 2 decks (Charizard X, Venusaur) replace the 2 Air Balloon with 3 Rare Candy (me01-125).

- **Basic Energy ids:**

  | Energy    | Id      |
  | --------- | ------- |
  | Grass     | mee-001 |
  | Fire      | mee-002 |
  | Water     | mee-003 |
  | Lightning | mee-004 |
  | Psychic   | mee-005 |
  | Fighting  | mee-006 |
  | Darkness  | mee-007 |
  | Metal     | mee-008 |

- **Card ids:** each card uses its first printing in me01 or me02, as listed in each task.
- **Script registration:** one script per card name. The registry maps scripts by name, so reprints share one script.
- **"Until the end of your opponent's next turn" effects** expire when that turn ends. They also end early if the Pokémon leaves the Active Spot (retreat, switch, KO) or evolves.
- **Picker labels:** "Starter decks", "Theme decks", "Custom decks". The intro still offers only the 3 starter decks.

## Review Focus

1. **Bots looping on repeatable Abilities** (Solar Transfer, Excited Turbo). Expected: every game still ends, and an Ability is offered at most `REPEATABLE_CAP` = 10 times per turn. Tested in Task 1 and the Task 8 fuzz run.
2. **Timed markers outliving their Pokémon.** A marked Pokémon retreats, is switched, is Knocked Out, or evolves. Expected: the marker is gone. Tested in Task 1.
3. **Prompt-driven attacks under replay.** Inferno X's multi-pick and Riotous Blasting's yes/no run inside the `damage` hook. Expected: answering resumes correctly and doesn't double-discard. Tested in Tasks 2 and 5.
4. **Gale Thrust timing.** A Pokémon promoted after a KO during the opponent's turn isn't "moved this turn" on your turn; one switched in this turn is. Tested in Task 7.
5. **Duel picker with 9+ decks at 375 px width.** Expected: no horizontal scroll. Tested in Task 8 (e2e phone check).

---

### Task 1: Engine additions

**Files:**

- Modify:
  - `packages/engine/src/types.ts`: `PokemonSlot.markers`, `PokemonSlot.becameActiveTurn`, `PlayerState.stadiumLockedTurn`
  - `state.ts`: slot defaults
  - `effects.ts`: `addMarker`, `lockStadium`, clear markers in `switchActive` and `evolve`, set `becameActiveTurn`
  - `actions.ts`: retreat sets `becameActiveTurn` and clears markers; `cantRetreat` blocks retreat; repeatable Abilities
  - `combat.ts`: markers in `dealAttackDamage`; `ignoreDefenderEffects`; promotion sets `becameActiveTurn`
  - `trainers.ts`: Stadium lock
  - `cards.ts`: `repeatable?: boolean` on Ability scripts; `ignoreDefenderEffects` in the attack damage return
  - `view.ts`: expose `markers` and `becameActiveTurn` in `SlotView`
- Test: `packages/engine/test/markers.test.ts`

**Interfaces (Produces):**

- `type MarkerKind = 'reduceIncoming' | 'preventFromBasic' | 'reduceOutgoing' | 'cantRetreat'`
- `PokemonSlot.markers: { kind: MarkerKind; amount: number; untilTurn: number }[]`. A marker is active while `state.turn <= untilTurn`.
- `ctx.addMarker(ref: SlotRef, kind: MarkerKind, amount = 0): void` sets `untilTurn = state.turn + 1`, i.e. through the opponent's next turn.
- `PokemonSlot.becameActiveTurn: number | null`. Set to `state.turn` whenever a Pokémon moves from the Bench to the Active Spot: retreat, `switchActive`, a promotion after a KO, or the opponent's gust.
- `PlayerState.stadiumLockedTurn: number | null`, set by `ctx.lockStadium(player)` to `state.turn + 1`. While `state.turn === stadiumLockedTurn`, that player has no Stadium plays.
- `dealAttackDamage` applies markers in this order:
  1. `reduceOutgoing` on the attacker, before Weakness/Resistance;
  2. Weakness/Resistance;
  3. `modifyIncomingDamage` hooks;
  4. `reduceIncoming` on the defender;
  5. `preventFromBasic` on the defender: 0 if the attacker's top card is a Basic Pokémon.
- `{ amount, ignoreWR?, ignoreDefenderEffects? }` (the attack `damage` return) and the matching `dealAttackDamage` option skip steps 4–5 and the defender-held `modifyIncomingDamage` hooks.
- Ability script: `{ canUse, use, repeatable?: boolean }`. A repeatable Ability can be used up to `REPEATABLE_CAP = 10` times per turn per Pokémon. Exported from `@ptcg/engine`.

- [ ] **Step 1: Failing tests** in `markers.test.ts`, using the `@ptcg/engine/testing` fixtures and `miniRegistry` scripts defined in the test:
  - `reduceIncoming` 30 cuts a 60-damage attack to 30, and expires after the opponent's turn ends.
  - `preventFromBasic`: a Basic attacker deals 0; a Stage 1 attacker deals full damage.
  - `reduceOutgoing` 20 on the Defending Pokémon reduces its next attack before Weakness: base 30 against a Weakness-×2 defender deals (30−20)×2 = 20.
  - `cantRetreat` removes the retreat action until the marker expires.
  - Retreating, `switchActive` and `evolve` clear markers; a KO removes the slot and its markers.
  - `becameActiveTurn`:
    - retreat sets it to the current turn;
    - a promotion after a KO on turn T sets T;
    - Gale Thrust-style logic on turn T+1 sees `becameActiveTurn !== state.turn`.
  - `ignoreDefenderEffects` skips `reduceIncoming` and the defender's own `modifyIncomingDamage`.
  - Stadium lock: the locked player has no `playTrainer` actions for Stadiums on the next turn, but can play them the turn after.
  - A repeatable Ability is offered again after use; after 10 uses in a turn it's no longer offered; a normal Ability is offered once.
- [ ] **Step 2:** Run `pnpm --filter @ptcg/engine test -- markers`. Expected: FAIL.
- [ ] **Step 3:** Implement. The existing `cantAttackOnTurn` and `attackLocks` clearing points show where markers must clear.
- [ ] **Step 4:** Run `pnpm check`. Expected: all green, with existing tests unchanged.
- [ ] **Step 5:** Commit `feat(engine): timed markers, stadium lock, becameActiveTurn, repeatable abilities`.

### Tasks 2–7: one deck each

Each deck task follows the same steps:

- [ ] **Step 1: Failing tests** in `packages/cards/test/<deck>-deck.test.ts`. Follow the style of `lucario-deck.test.ts`, using the helpers in `test/helpers.ts`:
  - one test per new script, asserting the behaviour listed below;
  - one deck test asserting:
    - the deck totals 60;
    - every card exists and passes `isPlayable`;
    - `validateCustomDeck(deck, registry, ownAll)` returns `[]`.
- [ ] **Step 2:** Run `pnpm --filter @ptcg/cards test -- <deck>`. Expected: FAIL.
- [ ] **Step 3:** Add the scripts, register them in `scripts/index.ts`, and add `src/decks/<deck>.json`, exported from `src/index.ts` as `<camelCase>Deck`.
- [ ] **Step 4:** Run `pnpm check`. Expected: green.
- [ ] **Step 5:** Commit `feat(cards): <Deck name> theme deck`.

The card lists below give each card's count, id and the behaviour its test asserts. Cards marked vanilla need no script. Energy fills each deck to 60.

#### Task 2: Mega Charizard X ex — `mega-charizard-x.json`

- **Charmander ×4** (me02-011). Agile: Retreat Cost 0 with no Energy attached, otherwise 2.
- **Charmeleon ×2** (me02-012). Vanilla.
- **Mega Charizard X ex ×3** (me02-013). Inferno X:
  - prompts a multi-pick (min 0) over every {R}-providing Energy attached to your Pokémon;
  - discards the picks;
  - deals 90 × the number picked. Picking 3 deals 270.
- **Oricorio ex ×2** (me02-018). Excited Turbo, repeatable:
  - only usable with a {R} Mega ex in play;
  - attaches a Basic {R} Energy from your hand to a Benched {R} Pokémon.
  - Fire Wing is vanilla.
- **Moltres ×2** (me02-014). Fighting Wings: 20, or 110 against a Pokémon ex.
- **Volcanion ×1** (me01-025).
  - Singe: Burns.
  - Backfire: 130, then puts 2 {R} Energy from itself into your hand.
- **Chi-Yu ×1** (me01-031). Scorching Earth: 40. If the opponent owns the Stadium in play, discard it and `lockStadium(opponent)`.
- **Trainers:** core with Rare Candy.
- **Energy:** Fire ×19.

#### Task 3: Mega Venusaur ex — `mega-venusaur.json`

- **Bulbasaur ×4** (me01-001). Bind Down: 10, plus a `cantRetreat` marker on the Defending Pokémon.
- **Ivysaur ×3** (me01-002). Vanilla.
- **Mega Venusaur ex ×3** (me01-003).
  - Solar Transfer, repeatable: move a Basic {G} Energy from one of your Pokémon to another. Two prompts: pick the Energy, then the target.
  - Jungle Dump: 240, and heals 30 from itself.
- **Exeggcute ×2** (me01-004). Jam-Packed: attach a Basic {G} Energy from your deck to itself, then shuffle.
- **Exeggutor ×2** (me01-005).
  - Guard Press: 30, plus `reduceIncoming` 30 on itself.
  - Stomping Wood: 60 + 30 per {G} Energy attached.
- **Shuckle ×2** (me01-011).
  - Fermented Juice: once a turn, with {G} attached, heal 30 from one of your Pokémon.
  - Rollout is vanilla.
- **Celebi ×1** (me01-012).
  - Traverse Time: search up to 3 {G} Pokémon and/or Stadium cards into your hand, then shuffle.
  - Solar Cutter is vanilla.
- **Trainers:** core with Rare Candy.
- **Energy:** Grass ×17.

#### Task 4: Mega Abomasnow ex — `mega-abomasnow.json`

- **Snover ×4** (me01-035). Vanilla.
- **Mega Abomasnow ex ×3** (me01-036).
  - Hammer-lanche: discard the top 6 cards of your deck; 100 × the Basic {W} Energy among them. With fewer than 6 cards, discard what's there.
  - Frost Barrier: 200, plus `reduceIncoming` 30 on itself.
- **Suicune ×2** (me02-026). Crystal Fall: 30, +90 with ≥4 {W} Energy attached across your Pokémon.
- **Kyogre ×2** (me01-034).
  - Riptide: 20 × the Basic {W} Energy in your discard pile, then shuffle those into your deck.
  - Swirling Waves: 130, then discard 2 Energy from itself (prompt).
- **Mantine ×2** (me01-032).
  - Call for Family: reuse Toxel's script logic (me02-067) through a shared util `callForFamily(ctx, 2)`.
  - Waterfall is vanilla.
- **Eiscue ×1** (me01-044).
  - Freezing Headbutt: 20, and on heads the opponent's Active is Paralyzed.
  - Tackle is vanilla.
- **Trainers:** core.
- **Energy:** Water ×21.

#### Task 5: Mega Manectric ex — `mega-manectric.json`

- **Electrike ×4** (me01-049). Thunder Jolt: 30, plus 10 to itself.
- **Mega Manectric ex ×3** (me01-050).
  - Flash Ray: 120, plus a `preventFromBasic` marker on itself.
  - Riotous Blasting: a yes/no prompt "Discard all Energy for +130?". Yes: discard all Energy from itself, 330 damage. No: 200.
- **Raikou ×2** (me01-048). Electro Fall: 30, +90 with ≥4 {L} Energy attached across your Pokémon.
- **Yamper ×2** (me02-030). Play Rough: 20, +20 on heads.
- **Boltund ×2** (me02-031). Electric Run: 70, +70 on heads.
- **Magnemite ×2** (me01-045). Vanilla.
- **Magneton ×1** (me01-046). Thunder Shock: 30, and on heads the opponent's Active is Paralyzed.
- **Trainers:** core.
- **Energy:** Lightning ×19.

#### Task 6: Mega Kangaskhan ex — `mega-kangaskhan.json`

- **Mega Kangaskhan ex ×4** (me01-104).
  - Run Errand: only while Active, and only if `!usedAbilityNameThisTurn('Run Errand')`. Draws 2 and marks the name. A second Kangaskhan can't use it in the same turn.
  - Rapid-Fire Combo: 200 + 50 per heads, flipping until tails.
- **Miltank ×2** (me01-106).
  - Bellyful of Milk: flip 2; if both are heads, heal all damage from one of your Pokémon.
  - Tackle is vanilla.
- **Stufful ×2** (me01-111). Vanilla.
- **Bewear ×2** (me01-112).
  - Knuckle Punch is vanilla.
  - Hyper Lariat: 100, +100 if both of 2 flips are heads.
- **Zigzagoon ×2** (me02-081). Surprise Attack: 30 on heads, 0 on tails.
- **Linoone ×2** (me02-082).
  - Excited Dash: once a turn, from the Bench, with any Mega ex in play, switch this Pokémon with your Active Pokémon. This sets Linoone's `becameActiveTurn`.
  - Slash is vanilla.
- **Meowth ×1** (me02-106). Fury Swipes: 20 × heads from 3 flips.
- **Trainers:** core.
- **Energy:** 10 Lightning + 10 Fighting.

#### Task 7: Mega Lopunny ex — `mega-lopunny.json`

- **Buneary ×4** (me01-107).
  - Charm: a `reduceOutgoing` 20 marker on the Defending Pokémon.
  - Skip is vanilla.
- **Mega Lopunny ex ×3** (me02-084).
  - Gale Thrust: 60, or 230 if `becameActiveTurn === state.turn`.
  - Spiky Hopper: 160 with `ignoreDefenderEffects`. Test: with `reduceIncoming` 30 on the defender it still deals 160 (before Weakness).
- **Lopunny ×1** (me01-108).
  - Dashing Kick: 50 to one opponent Benched Pokémon (prompt), no Weakness/Resistance. It does nothing if the opponent has no Bench.
  - Spiral Kick is vanilla.
- **Zigzagoon ×2, Linoone ×2.** From Task 6.
- **Jigglypuff ×2** (me02-076). Ball Roll: 20 × heads, flipping until tails.
- **Wigglytuff ×2** (me02-077).
  - Round: 40 × your Pokémon in play that have an attack named "Round".
  - Seismic Toss is vanilla.
- **Trainers:** core.
- **Energy:** 10 Lightning + 9 Fighting.

### Task 8: Picker, catalog, fuzz and e2e

**Files:** Modify `apps/web/src/game/catalog.ts`, `apps/web/src/screens/DuelSetup.tsx`, `packages/bots/test/fuzz.test.ts`, `apps/web/e2e/smoke.spec.ts`. Test: `apps/web/test/picker.test.tsx`.

**Interfaces:**

- `DeckInfo` gains `kind: 'starter' | 'theme'`.
- `DeckId` adds:
  - `'mega-charizard-x'`
  - `'mega-venusaur'`
  - `'mega-abomasnow'`
  - `'mega-manectric'`
  - `'mega-kangaskhan'`
  - `'mega-lopunny'`
- Cover card for each deck: its Mega ex.
- `DeckSource` gains `kind: 'starter' | 'theme' | 'custom'`.
- The intro keeps `DECKS.filter(d => d.kind === 'starter')`.

- [ ] **Step 1: Failing tests.**
  - Each deck group in Duel shows three labelled sections: "Starter decks" (3), "Theme decks" (6) and "Custom decks" (only when present).
  - Picking "Mega Venusaur ex" for both sides starts a game with Mega Venusaur ex cards for both owners.
  - The intro still shows exactly 3 decks.
- [ ] **Step 2:** Run `pnpm --filter @ptcg/web test -- picker`. Expected: FAIL.
- [ ] **Step 3:** Implement.
  - **Fuzz:** iterate all pairs of the 9 decks (45 pairings, including mirrors), with `FUZZ_GAMES` default 540 split evenly as 12 per pairing.
  - **e2e:** pick "Mega Charizard X ex" in the Duel test, and add the Duel screen to the 375 px no-scroll check.
- [ ] **Step 4:** Run `pnpm check` and Playwright. Expected: green.
- [ ] **Step 5:** Commit `feat(web): theme decks in the duel picker`.

### Task 9: Balance check and ship

- [ ] Add `packages/bots/scripts/round-robin.ts`. It plays 40 Easy-vs-Easy games per ordered pair across the 9 decks and prints each deck's win rate.
- [ ] Any deck outside 30–70%: adjust only its Pokémon/Energy counts (keeping the Global Constraints), re-run, and record the change in the commit message.
- [ ] Whole-branch review, then a fix pass (test-first), then PR → green CI → merge → production check.
