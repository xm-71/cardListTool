# Meta decks, part 3: Johto Elite Four and Johto Lance (one PR) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Will, Johto Koga, Johto Bruno, Karen and Johto Lance play type-matched meta decks, finishing the top of the Gym
Challenge (spec deliveries 1 and 2 are merged: Kanto Elite Four, Blue ×3, Red).

**Architecture:** As in parts 1 and 2: leader decks are JSON under `packages/cards/src/decks/gym/` (ids unchanged); new card
behaviour is one script per card under `packages/cards/src/scripts/<set>/<number>.ts`, registered in
`src/scripts/index.ts`; deck tests live in `packages/cards/test/meta-leader-decks.test.ts`. **No set imports or packs are
needed:** every card below is in a set that is already imported (`me01`, `sv01`–`sv07`, `sv09`, `sv03.5`, `sv06.5`).

**Tech Stack:** TypeScript, vitest, pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-10-16-meta-decks-sv-me-design.md` (this plan is its delivery 3). Parts 1 and 2 are
`docs/superpowers/plans/2026-10-16-meta-decks-pr1.md` and `2026-11-11-meta-decks-champions-red.md`; their ledgers' rulings
carry over (drafted lists because tournament sites are unreachable from the build environment, stand-ins listed in the PR).

## Global Constraints

- No changes to `packages/engine`. A card the engine cannot run is replaced by a stand-in and listed in the PR.
- Leader decks: 60 cards, every card playable (`isPlayable`), at most 4 of a name (Basic Energy excepted), at most 1
  ACE SPEC; regulation mark D or later, or from `sv03.5` or an `me*` set (`assertGymDeck(deck, 'leader')`).
- **Every new Pokémon script exports `set`** (its TCGdex set id). A script without `set` is registered by name and the
  last one wins, which silently replaced the Charmander the Mega Charizard X theme deck uses in part 2. Trainers and
  Energy scripts may omit it.
- **`pnpm lint`, `pnpm typecheck` and the full `pnpm test` pass before a task is recorded complete and before every
  push** (a narrower run hid five failures in part 2).
- Deck ids, leader ids, leader difficulty (Hard in Johto), rewards and the player's own deck rules do not change.
- Probe bands (win rate with the in-game bot, `--probe 3`, 54 games): Johto Elite Four (Will, Johto Koga, Johto Bruno,
  Karen) 60–70%; Johto Lance 65–75%. After three tuning rounds without reaching a band, keep the best list, stop and
  report the numbers; a change that makes a deck clearly worse is reverted. The probe is deterministic for a given list.
- Per `CLAUDE.md`: deck ids are unchanged, so the bot lists already carry these decks; confirm `gym-fuzz.test.ts` passes.
- Whole sets are already imported; the new scripts are the only data change.

## Review Focus

Failure modes the per-task tests do not name but a player would meet; each has a test in the task that owns it.

1. **Roaring Moon ex's Frenzied Gouging** Knocks Out the Defending Pokémon whatever its HP or effects, *then* puts 200
   damage on itself: that can Knock Out the attacker too (2 Prizes), and the opponent's Prize for the first Knock Out
   comes first (Task 2).
2. **Klawf's Snipping Pincers** flips 2 coins and discards one Energy per heads from the Defending Pokémon, never more
   than it has, and does nothing to an Energy-less Pokémon (Task 3). Only the `sv09` Klawf is in the deck: the other
   Klawf prints have different attacks, so the script must be scoped by `set`.
3. **Terapagos ex's Unified Beatdown** is unavailable on the first turn of the player who goes second, and counts only
   the user's own Bench (Task 3).
4. **Mega Absol ex's Terminal Period** needs *exactly* 6 damage counters on the Defending Pokémon (not 5 or 7), and
   Claw of Darkness reveals the hand and discards a card the *user* picks (Task 4).
5. **Raging Bolt ex's Bellowing Thunder** discards any amount of Basic Energy from *any* of the user's Pokémon, and the
   smart bot's payment rule for such prompts must still apply (Task 5; the rule is in `packages/bots/src/smart.ts`).

## Delivery

One PR from the dev branch reset to `master`: Tasks 1–6 in order; each task commits on its own, and after each push
the branch is reset only after the PR merges.

## File structure

- `packages/cards/src/scripts/**`: one new file per newly scripted card, plus `index.ts` entries.
- `packages/cards/src/decks/gym/{will,johto-koga,johto-bruno,karen,johto-lance}.json`: replaced.
- `packages/cards/test/{sv-dark,sv-fighting,me01-dark,sv-dragon}.test.ts`: card tests (one file per task that has scripts).
- `packages/cards/test/meta-leader-decks.test.ts`: the five deck tests (leader pool, exact lists).
- `packages/cards/test/gym-{will,johto-koga,johto-bruno,karen,johto-lance}.test.ts`: their deck-only tests are removed
  (the file is deleted if nothing else is in it, otherwise renamed for what it covers, as in part 2: `*-gym-cards.test.ts`).
- `packages/economy/test/gym-decks.test.ts`: `META_LEADERS` gains the five ids.
- `packages/bots/scripts/round-robin.ts`: `PROBE_TARGETS` gains five bands; `GYM_TARGETS` loses these ids' entries.
- `packages/bots/test/plan.test.ts`: one case per deck; `packages/bots/src/plans.ts` only if a plan needs an override.
- `apps/web/src/game/gym.ts`: the five leaders' `type` labels, only where they no longer describe the deck.

---

### Task 1: Will — Lillie's Clefairy ex (Psychic)

**Files:**
- Create scripts: none expected (Lillie's Clefairy ex, Munkidori, Mew ex, Fezandipiti ex, Squawkabilly ex, Counter Catcher,
  Bravery Charm and the Trainers are playable already); run Step 1 to confirm.
- Modify: `packages/cards/src/decks/gym/will.json`; `packages/bots/src/plans.ts` if Step 4 needs it
- Test: `meta-leader-decks.test.ts` (deck test), `plan.test.ts` (one case); remove Will's old deck test in `gym-will.test.ts`

**Deck** ("Will's Clefairy Deck"): 4 Lillie's Clefairy ex `sv09-056`, 4 Munkidori `sv06-095`, 1 Mew ex `sv03.5-151`,
1 Fezandipiti ex `sv06.5-038`, 1 Squawkabilly ex `sv02-169`; 4 Arven `sv01-166`, 3 Iono `sv02-185`, 3 Professor's Research
`sv09-155`, 2 Boss's Orders `me01-114`; 4 Ultra Ball `me01-131`, 4 Nest Ball `sv01-181`, 2 Night Stretcher `me01-173`,
2 Switch `me01-130`, 1 Super Rod `sv02-188`, 2 Counter Catcher `sv04-160`, 1 Prime Catcher `sv05-157`; 2 Bravery Charm
`sv02-173`, 1 Air Balloon `me01-166`; 14 Psychic Energy `mee-005`, 4 Darkness Energy `mee-007` (= 60).

- [ ] **Step 1: List what is unplayable:** with a scratch test (not committed), print every deck id with
  `isPlayable(registry.defs[id], registry) === false`. Expected: none. A hit needs a script (Task 2's pattern).
- [ ] **Step 2: Write the failing deck test** in `meta-leader-decks.test.ts`: `assertGymDeck(GYM_DECKS.will, 'leader')`,
  `deck.name` equals the name above and the exact count map. Run it — Expected: FAIL (old name).
- [ ] **Step 3: Write `will.json`, add `'will'` to `META_LEADERS`** in `packages/economy/test/gym-decks.test.ts`, delete
  Will's deck-only test(s) from `gym-will.test.ts`, run both test files — Expected: PASS.
- [ ] **Step 4: Plan test** in `plan.test.ts`: `deckPlan(GYM_DECKS.will, registry).attackers` contains
  `"Lillie's Clefairy ex"`; if not, add a `DECK_PLANS` entry (`attackers: ["Lillie's Clefairy ex"]`); run — PASS.
- [ ] **Step 5: Full checks and fuzz:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, and
  `pnpm --filter @ptcg/bots exec vitest run test/gym-fuzz.test.ts -t will` — Expected: all PASS.
  **Commit** `git commit -m "Gym: Will plays Lillie's Clefairy ex"`.

### Task 2: Johto Koga — Roaring Moon ex / Pecharunt ex (Poison and Darkness)

**Files:**
- Create scripts (registered, each exporting `set`): `sv04/124` Roaring Moon ex, `sv06.5/036` Okidogi ex (Pecharunt ex
  `sv06.5-039` and Munkidori are playable already)
- Modify: `packages/cards/src/decks/gym/johto-koga.json`; `packages/bots/src/plans.ts` if Step 5 needs it
- Test: `packages/cards/test/sv-dark.test.ts` (card tests), `meta-leader-decks.test.ts`, `plan.test.ts`; remove Koga's old
  deck-only tests in `gym-johto-koga.test.ts`; `gym.ts` type label only if it no longer fits ("Poison" → keep if it does)

**Deck** ("Koga's Roaring Moon Deck"): 3 Roaring Moon ex `sv04-124`, 3 Pecharunt ex `sv06.5-039`, 2 Okidogi ex
`sv06.5-036`, 2 Munkidori `sv06-095`, 1 Fezandipiti ex `sv06.5-038`; 4 Arven `sv01-166`, 2 Iono `sv02-185`, 3 Professor's
Research `sv09-155`, 3 Boss's Orders `me01-114`; 4 Ultra Ball `me01-131`, 3 Nest Ball `sv01-181`, 3 Night Stretcher
`me01-173`, 1 Switch `me01-130`, 1 Prime Catcher `sv05-157`, 2 Counter Catcher `sv04-160`, 1 Super Rod `sv02-188`,
3 Earthen Vessel `sv04-163`; 1 Air Balloon `me01-166`; 18 Darkness Energy `mee-007` (= 60).

- [ ] **Step 1: List what is unplayable** as in Task 1 Step 1 (expect Roaring Moon ex and Okidogi ex).
- [ ] **Step 2: Write the failing card tests** in `sv-dark.test.ts`. Fixed expectations (Review Focus 1):
  **Frenzied Gouging** ({D}{D}{C}) Knocks Out the Defending Pokémon whatever its HP and the attacker then has 200 damage
  on it; the opponent's Active is replaced from the Bench and the attacker's owner takes the Prize(s); with 30 damage
  already on a 230-HP Roaring Moon ex it is Knocked Out too (the opponent takes 2 Prizes, the attacker's owner the Prize
  for the first Knock Out first). **Calamity Storm** does 100; with a Stadium in play the player may discard it for 120
  more (220), and declining keeps the Stadium and does 100. **Okidogi ex, Poisonous Musculature** ({C}) attaches up to
  2 Basic {D} Energy from the deck to itself, shuffles, and is Poisoned only if at least one was attached; **Chain-Crazed**
  does 130, and 260 while Okidogi ex is Poisoned.
- [ ] **Step 3: Run** `pnpm --filter @ptcg/cards exec vitest run test/sv-dark.test.ts` — Expected: FAIL.
- [ ] **Step 4: Implement** the scripts (helpers in `src/scripts/util.ts`: `searchDeck`, `isBasicEnergy`; `ctx.knockOut(ref)`
  and `ctx.damageSelf(amount)`; Poison through the existing condition helper other scripts use), register them, run the
  tests — Expected: PASS.
- [ ] **Step 5: Deck test, `johto-koga.json`, `META_LEADERS`, plan test** as in Task 1 Steps 2–4
  (`deckPlan(GYM_DECKS['johto-koga'], registry).attackers` contains `'Roaring Moon ex'` or `'Pecharunt ex'`).
- [ ] **Step 6: Full checks and fuzz** (`-t johto-koga`). **Commit** `git commit -m "Gym: Koga plays Roaring Moon ex and Pecharunt ex"`.

### Task 3: Johto Bruno — Klawf / Terapagos ex (Fighting)

**Files:**
- Create scripts (registered, each exporting `set`): `sv09/090` Klawf, `sv07/128` Terapagos ex (Bloodmoon Ursaluna ex,
  Fighting Gong and Premium Power Pro are playable already)
- Modify: `packages/cards/src/decks/gym/johto-bruno.json`; `packages/bots/src/plans.ts` if Step 5 needs it
- Test: `packages/cards/test/sv-fighting.test.ts`, `meta-leader-decks.test.ts`, `plan.test.ts`; remove the old deck-only
  tests in `gym-johto-bruno.test.ts`

**Deck** ("Bruno's Klawf Deck"): 4 Klawf `sv09-090`, 3 Terapagos ex `sv07-128`, 2 Bloodmoon Ursaluna ex `sv06-141`,
1 Fezandipiti ex `sv06.5-038`, 1 Squawkabilly ex `sv02-169`, 1 Mew ex `sv03.5-151`; 3 Arven `sv01-166`, 2 Iono `sv02-185`,
3 Professor's Research `sv09-155`, 3 Boss's Orders `me01-114`; 4 Ultra Ball `me01-131`, 4 Nest Ball `sv01-181`,
2 Night Stretcher `me01-173`, 2 Switch `me01-130`, 1 Super Rod `sv02-188`, 3 Earthen Vessel `sv04-163`, 1 Prime Catcher
`sv05-157`, 3 Fighting Gong `me01-116`, 2 Premium Power Pro `me01-124`; 1 Air Balloon `me01-166`; **14** Fighting Energy
`mee-006` (= 60).

- [ ] **Step 1: List what is unplayable** as in Task 1 Step 1 (expect Klawf and Terapagos ex).
- [ ] **Step 2: Write the failing card tests** in `sv-fighting.test.ts`. Fixed expectations (Review Focus 2 and 3):
  **Klawf, Snipping Pincers** discards one Energy from the Defending Pokémon for each heads of 2 coins (use a seed or the
  test helper that fixes coin flips; cover 0, 1 and 2 heads, and a Defending Pokémon with only 1 Energy), and does nothing
  to a Pokémon with no Energy; **Hammer In** does 100. **Terapagos ex, Unified Beatdown** does 30 for each of the user's
  Benched Pokémon (0, 2 and 5 Bench), is not offered on the first turn of the player who goes second (the player who goes first cannot attack on turn 1
  anyway, so assert the second-player case and that it is offered on a later turn). **Crown Opal** ({G}{W}{L}) does 180; if the engine has a marker
  that expresses "prevent all damage done by attacks from Basic non-{C} Pokémon during the opponent's next turn", use it
  and test it, otherwise rule (ledger) that the deck cannot pay Crown Opal (no {G}/{W}/{L} Energy) and script only the
  damage. Both Klawf prints with different attacks (`sv01-122`, `sv04-105`) must *not* get the `sv09` script.
- [ ] **Step 3: Run** `pnpm --filter @ptcg/cards exec vitest run test/sv-fighting.test.ts` — Expected: FAIL.
- [ ] **Step 4: Implement** the scripts, register them, run the tests — Expected: PASS.
- [ ] **Step 5: Deck test, `johto-bruno.json`, `META_LEADERS`, plan test** (`attackers` contains `'Klawf'` or
  `'Terapagos ex'`) as in Task 1 Steps 2–4.
- [ ] **Step 6: Full checks and fuzz** (`-t johto-bruno`). **Commit** `git commit -m "Gym: Bruno plays Klawf and Terapagos ex"`.

### Task 4: Karen — Mega Absol ex (Darkness)

**Files:**
- Create script (registered, exporting `set`): `me01/086` Mega Absol ex
- Modify: `packages/cards/src/decks/gym/karen.json`; `packages/bots/src/plans.ts` if Step 5 needs it
- Test: `packages/cards/test/me01-dark.test.ts`, `meta-leader-decks.test.ts`, `plan.test.ts`; remove the old deck-only
  tests in `gym-karen.test.ts`

**Deck** ("Karen's Mega Absol Deck"): 3 Mega Absol ex `me01-086`, 3 Munkidori `sv06-095`, 2 Pecharunt ex `sv06.5-039`,
1 Fezandipiti ex `sv06.5-038`, 1 Squawkabilly ex `sv02-169`, 1 Mew ex `sv03.5-151`; 3 Arven `sv01-166`, 3 Iono `sv02-185`,
3 Professor's Research `sv09-155`, 3 Boss's Orders `me01-114`; 4 Ultra Ball `me01-131`, 4 Nest Ball `sv01-181`,
2 Night Stretcher `me01-173`, 1 Switch `me01-130`, 1 Super Rod `sv02-188`, 1 Prime Catcher `sv05-157`, 2 Counter Catcher
`sv04-160`, 3 Earthen Vessel `sv04-163`; 1 Air Balloon `me01-166`; 18 Darkness Energy `mee-007` (= 60).

- [ ] **Step 1: List what is unplayable** as in Task 1 Step 1 (expect Mega Absol ex).
- [ ] **Step 2: Write the failing card tests** in `me01-dark.test.ts`. Fixed expectations (Review Focus 4): **Terminal Period**
  ({D}{C}) Knocks Out the Defending Pokémon with exactly 6 damage counters (60 damage) on it, and does nothing at 50 or
  70 damage (and no damage is dealt by the attack itself); **Claw of Darkness** ({D}{D}{C}) does 200, reveals the
  opponent's hand and the attacker's owner discards one card from it of their choice (the prompt is the *attacker's*; an
  empty hand does nothing).
- [ ] **Step 3: Run** `pnpm --filter @ptcg/cards exec vitest run test/me01-dark.test.ts` — Expected: FAIL.
- [ ] **Step 4: Implement** the script (`ctx.knockOut(ref)`, `ctx.reveal`, `ctx.chooseCards` with `player: ctx.me` over the
  opponent's hand), register it, run — Expected: PASS.
- [ ] **Step 5: Deck test, `karen.json`, `META_LEADERS`, plan test** (`attackers` contains `'Mega Absol ex'`) as in Task 1
  Steps 2–4.
- [ ] **Step 6: Full checks and fuzz** (`-t karen`). **Commit** `git commit -m "Gym: Karen plays Mega Absol ex"`.

### Task 5: Johto Lance — Raging Bolt ex / Teal Mask Ogerpon ex (Dragon)

**Files:**
- Create script (registered, exporting `set`): `sv05/123` Raging Bolt ex (Teal Mask Ogerpon ex is playable already)
- Modify: `packages/cards/src/decks/gym/johto-lance.json`; `apps/web/src/game/gym.ts` if the label no longer fits;
  `packages/bots/src/plans.ts` if Step 5 needs it
- Test: `packages/cards/test/sv-dragon.test.ts`, `meta-leader-decks.test.ts`, `plan.test.ts`; remove the old deck-only
  tests in `gym-johto-lance.test.ts` (keep its Dragonite and Charizard card tests under a renamed file)

**Deck** ("Lance's Raging Bolt Deck"): 4 Raging Bolt ex `sv05-123`, 3 Teal Mask Ogerpon ex `sv06-025`, 1 Squawkabilly ex
`sv02-169`, 1 Fezandipiti ex `sv06.5-038`, 1 Mew ex `sv03.5-151`; 4 Arven `sv01-166`, 2 Iono `sv02-185`, 3 Professor's
Research `sv09-155`, 3 Boss's Orders `me01-114`; 4 Ultra Ball `me01-131`, 4 Nest Ball `sv01-181`, 2 Night Stretcher
`me01-173`, 2 Switch `me01-130`, 1 Super Rod `sv02-188`, 3 Earthen Vessel `sv04-163`, 1 Prime Catcher `sv05-157`,
2 Counter Catcher `sv04-160`; 1 Air Balloon `me01-166`; 7 Lightning Energy `mee-004`, 7 Fighting Energy `mee-006`,
4 Grass Energy `mee-001` (= 60).

- [ ] **Step 1: List what is unplayable** as in Task 1 Step 1 (expect Raging Bolt ex).
- [ ] **Step 2: Write the failing card tests** in `sv-dragon.test.ts`. Fixed expectations (Review Focus 5): **Burst Roar**
  ({C}) discards the user's hand and draws 6 cards (an empty hand just draws 6); **Bellowing Thunder** ({L}{F}) does 70
  for each Basic Energy card discarded from the user's Pokémon, chosen from *all* of them (Active and Bench), 0 when none
  are discarded, and never discards Special Energy. The prompt text is what the smart bot matches
  (`packages/bots/src/smart.ts`, `payAttachedEnergy`: it needs "N damage each" in the message): assert the script's prompt
  message contains `70 damage each`, and add a bots test (`packages/bots/test/hail-blade.test.ts` pattern) that the bot
  discards just enough Energy for a Knock Out with a Raging Bolt ex attacker.
- [ ] **Step 3: Run** `pnpm --filter @ptcg/cards exec vitest run test/sv-dragon.test.ts` — Expected: FAIL.
- [ ] **Step 4: Implement** the script, register it, run — Expected: PASS; run the bots test — Expected: PASS (if it
  fails, the prompt wording is wrong, not the bot).
- [ ] **Step 5: Deck test, `johto-lance.json`, `META_LEADERS`, plan test** (`attackers` contains `'Raging Bolt ex'`) as in
  Task 1 Steps 2–4; check Lance's `type` label in `gym.ts` ("Dragon") still fits and leave it.
- [ ] **Step 6: Full checks and fuzz** (`-t johto-lance`). **Commit** `git commit -m "Gym: Lance plays Raging Bolt ex"`.

### Task 6: Balance pass for the Johto five

**Files:**
- Modify: the five deck JSONs and their expected counts in `meta-leader-decks.test.ts`, or `packages/bots/src/plans.ts`,
  only as tuning needs
- Modify: `packages/bots/scripts/round-robin.ts` — `PROBE_TARGETS` gains `will`, `'johto-koga'`, `'johto-bruno'`,
  `karen`: `[60, 70]` and `'johto-lance'`: `[65, 75]`; delete these ids' `GYM_TARGETS` entries (they are measured by
  `--probe` now; check `LEADER_DIFFICULTY` lists them as `hard` and leave it)

- [ ] **Step 1: Probe** each leader alone in the background (`GYM_ONLY=<id> npx tsx scripts/round-robin.ts --probe 3`, all
  five processes in parallel, output to files, wait for the completion notifications; a foreground run is cut off at
  10 minutes and a container restart loses it, so re-run if one is lost). Expected: each in its band. Outside: change the
  list within the Global Constraints (counts, staples; energy count and draw/search were the levers that moved decks in
  part 2, and removing Energy hurt) or the deck plan, rerun, record every change with the win rates before and after in
  the ledger. After three rounds without reaching a band, keep the best list and stop.
- [ ] **Step 2: Full checks:** `pnpm typecheck && pnpm lint && pnpm test` — Expected: all PASS, and read the output: only
  then record the task complete.
- [ ] **Step 3: Commit** `git commit -m "Gym: tune the Johto Elite Four and Lance"` (if anything changed).

## Self-review notes

- Spec coverage: delivery 3 (Will, Johto Koga, Johto Bruno, Karen, Johto Lance, their plan overrides, `--probe` bands,
  fuzz) is Tasks 1–6; no set is imported, so there is no pack work (the spec's whole-set rule is already satisfied).
- Out of scope, unchanged: V / VMAX / VSTAR (spec 2), Sword & Shield decks (spec 3), the Kanto decks, making every card of
  the imported sets playable (backlog).
- Known weak points to expect from part 2's results: decks drafted without tournament data landed 20–25 points under
  their bands for Grass and Red, so the balance pass may stop at three rounds for some of these too; the PR says so.
