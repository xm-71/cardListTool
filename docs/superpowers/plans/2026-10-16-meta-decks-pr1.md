# Meta decks, PR 1: foundation and Kanto Elite Four — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lorelei, Bruno, Agatha and Lance (Kanto Elite Four) play type-matched meta decks; every set those decks touch is
imported whole and sold in the shop; a committed `--probe` mode measures leader strength.

**Architecture:** Card data comes from TCGdex through the existing importer (`packages/cards/scripts/import-cards.ts`),
now fed whole sets via `sets.json`. Leader decks are JSON files under `packages/cards/src/decks/gym/` (ids unchanged);
new card behaviour is a script per card under `packages/cards/src/scripts/<set>/<number>.ts`, registered in
`src/scripts/index.ts`. Shop packs are `PACKS` entries in `packages/economy/src/packs.ts`.

**Tech Stack:** TypeScript, vitest, pnpm workspaces, TCGdex REST API (`https://api.tcgdex.net/v2/en`).

**Spec:** `docs/superpowers/specs/2026-10-16-meta-decks-sv-me-design.md` (this plan covers its PR 1; PRs 2 and 3 get
their own plans).

## Global Constraints

- No changes to `packages/engine`. A card the engine cannot run is replaced by a stand-in and listed in the PR.
- Leader decks: 60 cards, every card playable (`isPlayable`), at most 4 of a name (Basic Energy excepted), at most 1
  ACE SPEC; cards with regulation mark D or later, or from the 151 (`sv03.5`) or Mega Evolution (`me*`) sets.
- No Sword & Shield (`swsh*`) cards in this PR: their whole-set import needs spec 2 (V / VMAX / VSTAR).
- Deck ids, leader ids, leader difficulty, rewards and the player's own deck rules do not change.
- Whole sets: every set any card of a replaced deck comes from is in `sets.json` and has a shop pack.
- Probe bands (win rate of the leader's deck with its in-game bot): Kanto Elite Four 55–65%.
- Rulings carried from the spec: Technical Machine: Evolution / Devolution and Flutter Mane need engine features the
  engine lacks (Tool-granted attacks, Ability lock), so they are left out; `GYM_TARGETS` loses its entries for replaced
  decks (they are measured by `--probe` with `PROBE_TARGETS` instead, which is the measure the spec defines).

## Review Focus

1. A card in a newly imported set that the normalizer cannot read (unknown stage, trainer type or energy) must fail
   the import with the card id named, not silently drop it. → Task 2 test `every card of the new sets normalizes`.
2. A card whose rarity no pack slot produces could never be pulled from its pack. → Task 3 test `every rarity in each
   new shop set can be pulled`.
3. The player's rules must not widen: a Paldea Evolved card (mark G) stays out of the player's Standard decks. → Task 3
   test `a newly imported mark G card is not Standard-legal for the player`.
4. Unscripted cards from the new sets must never end up in a leader deck, a premade deck or a Battle Frontier deck. →
   Task 1 (`assertGymDeck` checks playability) and Task 9 test `frontier pool only uses playable cards`.
5. Deck plans for the new decks must pick the real attacker (e.g. Chien-Pao ex, Gardevoir ex), or the bot fuels the
   wrong Pokémon. → Tasks 7 and 8 plan tests.

---

### Task 1: Leader legality mode

**Files:**
- Modify: `packages/cards/test/helpers.ts` (`assertGymDeck`)
- Test: `packages/cards/test/gym-legality.test.ts` (new)

**Interfaces:**
- Produces: `assertGymDeck(deck: DeckList, pool: 'gym' | 'leader' = 'gym'): void`. `'gym'` is today's rule (mark ≥ H
  or `sv03.5`); `'leader'` allows mark ≥ 'D' or a set id starting `sv03.5` or `me`. Both check 60 cards, playable,
  ≤ 4 per name, ≤ 1 ACE SPEC.

- [ ] **Step 1: Write the failing test** `gym-legality.test.ts`: a deck of 4 Iono (`sv02-185`, mark G) + 56 Basic
  Psychic Energy fails `'gym'` (wrap in `expect(() => …).toThrow()`) and passes `'leader'`; the existing
  `GYM_DECKS.brock` passes both.
- [ ] **Step 2: Run** `pnpm --filter @ptcg/cards exec vitest run test/gym-legality.test.ts` — Expected: FAIL (the
  `'leader'` call still rejects mark G).
- [ ] **Step 3: Implement** the `pool` parameter in `assertGymDeck`.
- [ ] **Step 4: Run** the same command — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Cards: leader legality mode for Gym deck tests"`.

### Task 2: Import the ten sets whole

**Files:**
- Modify: `packages/cards/src/sets.json`, `packages/cards/src/data/cards.json`, `packages/cards/src/data/sets.json`
  (generated), `packages/cards/src/normalize.ts` only if a card fails to normalize
- Test: `packages/cards/test/sets.test.ts` (new); `packages/cards/test/normalize.test.ts` for any normalizer change

**Interfaces:**
- Produces: `NEW_SETS = ['sv01','sv02','sv04','sv05','sv06','sv06.5','sv07','sv09','me02.5','me03']` (exported from
  the test file only) and full card data for them.

- [ ] **Step 1: Write the failing test** `sets.test.ts`:

```ts
const SIZES: Record<string, number> = {
  sv01: 258, sv02: 279, sv04: 266, sv05: 218, sv06: 226, 'sv06.5': 99, sv07: 175, sv09: 190, 'me02.5': 295, me03: 124,
};
test('the new sets are imported whole', () => {
  for (const [set, n] of Object.entries(SIZES))
    expect(Object.keys(cards).filter((id) => id.startsWith(`${set}-`)).length, set).toBe(n);
});
test('every card of the new sets normalizes', () => {
  for (const id of Object.keys(cards).filter((i) => Object.keys(SIZES).some((s) => i.startsWith(`${s}-`))))
    expect(registry.defs[id], id).toBeDefined();
});
test('the new sets are shop sets', () => {
  for (const set of Object.keys(SIZES)) expect(setIds, set).toContain(set);
});
```
  (`cards` = `src/data/cards.json`, `setIds` = `src/sets.json`, `registry` from `helpers.ts`.) If TCGdex reports a
  different card count for a set on import day, use TCGdex's `cardCount.total` and note it in the commit.
- [ ] **Step 2: Run** `pnpm --filter @ptcg/cards exec vitest run test/sets.test.ts` — Expected: FAIL (counts 1–12).
- [ ] **Step 3: Add the ten ids to `sets.json` and run** `pnpm --filter @ptcg/cards import-cards`. If the normalizer
  throws for a card, extend `normalize.ts` for that case with a `normalize.test.ts` case naming the card, and rerun.
- [ ] **Step 4: Run** `pnpm --filter @ptcg/cards test` — Expected: PASS (fix any existing test that counts all cards
  by updating its number, saying so in the commit).
- [ ] **Step 5: Check the web build:** `pnpm --filter @ptcg/web build` before (from `git stash`) and after; record the size
  of the chunk holding `cards.json` in the commit message. Expected: builds; growth is reported in the PR.
- [ ] **Step 6: Commit** `git commit -m "Cards: import ten Scarlet & Violet and Mega Evolution sets whole"`.

### Task 3: Shop packs for the new sets

**Files:**
- Modify: `packages/economy/src/packs.ts` (`PACKS`, and `SV_SLOT10_RATES` or the mega rates only if needed)
- Test: `packages/economy/test/packs.test.ts`, `packages/economy/test/decks.test.ts`

**Interfaces:**
- Consumes: the imported sets (Task 2).
- Produces: one `PACKS` entry per new set, named by its TCGdex set name: `sv01` Scarlet & Violet, `sv02` Paldea Evolved,
  `sv04` Paradox Rift, `sv05` Temporal Forces, `sv06` Twilight Masquerade, `sv06.5` Shrouded Fable, `sv07` Stellar
  Crown, `sv09` Journey Together (era `'sv'`); `me02.5` Ascended Heroes, `me03` Perfect Order (era `'mega'`).

- [ ] **Step 1: Write the failing tests** in `packs.test.ts`: `the new sets are sold as packs` (each id above is a
  `PACKS` setId with the era given); `every rarity in each new shop set can be pulled` (for each new set, every
  distinct `rarity` of its cards is in `layoutRarities(era)`). In `decks.test.ts`: `a newly imported mark G card is not
  Standard-legal for the player` (Iono `sv02-185` fails the player's Standard check).
- [ ] **Step 2: Run** `pnpm --filter @ptcg/economy exec vitest run test/packs.test.ts test/decks.test.ts` — Expected:
  FAIL on the new tests.
- [ ] **Step 3: Implement** the `PACKS` entries (after `me02`). For a rarity the test reports as unpullable, add it to
  the era's slot-10 rates with weight 0.03 taken from `Rare` (e.g. `'ACE SPEC Rare'`), and keep the existing
  rate-frequency tests green.
- [ ] **Step 4: Run** `pnpm --filter @ptcg/economy test` — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Economy: packs for the new Scarlet & Violet and Mega sets"`.

### Task 4: `--probe` mode

**Files:**
- Modify: `packages/bots/scripts/round-robin.ts`

**Interfaces:**
- Produces: `npx tsx scripts/round-robin.ts --probe [gamesPerOpponent=1]`, `GYM_ONLY=<id,…>` filter,
  `HARD_SHARD=k/n` sharding, `HARD_ROUNDS` (default 8). Prints per leader
  `<id> <difficulty> win <pct>%  medTurns <n>  band <lo>-<hi> PASS|FAIL`, then `TALLY`.
  `PROBE_TARGETS: Record<string, [number, number]>` with `lorelei, bruno, agatha, lance: [55, 65]` (later PRs add
  theirs); `LEADER_DIFFICULTY` copies the difficulties from `apps/web/src/game/gym.ts` for every `GYM_DECKS` id.

- [ ] **Step 1: Implement** the mode: each leader deck with its difficulty's bot (Easy / Medium / Hard with
  `maxRounds: HARD_ROUNDS, now: () => 0`) vs the 6 meta + 3 Mega premade decks piloted by Hard (same options), both
  seats, `gamesPerOpponent` per seat; delete the `GYM_TARGETS` entries of the four replaced leaders.
- [ ] **Step 2: Verify** `GYM_ONLY=brock npx tsx scripts/round-robin.ts --probe` — Expected: one `brock` line with a
  win rate and `band - -` (no target) and a `TALLY` line; `pnpm lint` and `pnpm typecheck` clean.
- [ ] **Step 3: Commit** `git commit -m "Bots: --probe mode for leader deck strength"`.

### Task 5: Lance — Dragapult ex

**Files:**
- Modify: `packages/cards/src/decks/gym/lance.json`, `apps/web/src/game/gym.ts` (Lance `type: 'Dragon'`)
- Test: `packages/cards/test/gym-lance.test.ts` (rewritten)

- [ ] **Step 1: Write the failing test**: `assertGymDeck(GYM_DECKS.lance, 'leader')`; `expect(GYM_DECKS.lance.name)
  .toBe("Lance's Dragapult Deck")`; the deck's card counts equal `metaDragapultDeck`'s.
- [ ] **Step 2: Run** `pnpm --filter @ptcg/cards exec vitest run test/gym-lance.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement**: `lance.json` = the cards of `src/decks/meta-dragapult.json`, name "Lance's Dragapult
  Deck"; Lance's `type` → `'Dragon'`.
- [ ] **Step 4: Run** the test, then `pnpm --filter @ptcg/bots exec vitest run test/gym-fuzz.test.ts` — Expected:
  PASS.
- [ ] **Step 5: Commit** `git commit -m "Gym: Lance plays Dragapult ex"`.

### Task 6: Bruno — Mega Lucario ex

**Files:**
- Create: `packages/cards/src/scripts/me01/072.ts` (Makuhita), registered in `src/scripts/index.ts`
- Modify: `packages/cards/src/decks/gym/bruno.json`
- Test: `packages/cards/test/gym-bruno.test.ts` (rewritten)

**Deck** ("Bruno's Mega Lucario Deck"): 4 Riolu `me01-076`, 3 Mega Lucario ex `me01-077`, 2 Makuhita `me01-072`,
2 Hariyama `me01-073`, 2 Solrock `me01-075`, 2 Lunatone `me01-074`, 1 Fezandipiti ex `sv06.5-038`; 4 Lillie's
Determination `me01-119`, 2 Boss's Orders `me01-114`, 1 Iono `sv02-185`, 4 Ultra Ball `me01-131`, 4 Buddy-Buddy Poffin
`me01-167`, 4 Fighting Gong `me01-116`, 3 Premium Power Pro `me01-124`, 2 Night Stretcher `me01-173`, 2 Switch
`me01-130`, 1 Air Balloon `me01-166`, 1 Prime Catcher `sv05-157`; 16 Fighting Energy `mee-006`.

- [ ] **Step 1: Write the failing tests**: `assertGymDeck(GYM_DECKS.bruno, 'leader')`; a test of each Makuhita attack
  with a text effect, asserting what the card text says (read it from `cards.json`); skip the script if every attack
  has empty text (then only the deck test applies).
- [ ] **Step 2: Run** `pnpm --filter @ptcg/cards exec vitest run test/gym-bruno.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** the script (pattern: `src/scripts/me01/116.ts`) and `bruno.json`.
- [ ] **Step 4: Run** the test and `gym-fuzz.test.ts` — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Gym: Bruno plays Mega Lucario ex"`.

### Task 7: Lorelei — Chien-Pao ex / Baxcalibur

**Files:**
- Create scripts (each registered in `src/scripts/index.ts`): `sv02/061.ts` Chien-Pao ex, `sv02/057.ts` Frigibax,
  `sv02/059.ts` Arctibax, `sv02/060.ts` Baxcalibur, `sv02/169.ts` Squawkabilly ex, `sv02/189.ts` Superior Energy
  Retrieval, `sv02/188.ts` Super Rod, `sv04/163.ts` Earthen Vessel — only those with non-empty attack or Ability text
  or that are Trainers
- Modify: `packages/cards/src/decks/gym/lorelei.json`; `packages/bots/src/plans.ts` if Step 6 needs it
- Test: `packages/cards/test/sv-water.test.ts` (card tests), `packages/cards/test/gym-lorelei.test.ts` (rewritten),
  `packages/bots/test/plan.test.ts` (one case)

**Deck** ("Lorelei's Chien-Pao Deck"): 4 Chien-Pao ex `sv02-061`, 4 Frigibax `sv02-057`, 1 Arctibax `sv02-059`,
3 Baxcalibur `sv02-060`, 1 Squawkabilly ex `sv02-169`, 1 Fezandipiti ex `sv06.5-038`; 4 Professor's Research
`sv09-155`, 2 Iono `sv02-185`, 2 Boss's Orders `me01-114`, 4 Ultra Ball `me01-131`, 4 Nest Ball `sv01-181`, 3 Rare Candy
`me01-125`, 4 Superior Energy Retrieval `sv02-189`, 2 Earthen Vessel `sv04-163`, 1 Super Rod `sv02-188`, 2 Switch
`me01-130`, 1 Prime Catcher `sv05-157`, 2 Buddy-Buddy Poffin `me01-167`; 15 Water Energy `mee-003`.

- [ ] **Step 1: Write the failing card tests** in `sv-water.test.ts`, one per script, each asserting the card's text
  in a built position. Fixed expectations: Baxcalibur's Ability attaches any number of Basic Water Energy from hand
  (attach 3 in one turn, all three on board); Chien-Pao ex's attack deals the printed amount per Basic Water Energy
  discarded (discard 2 → 2 × the printed amount); Superior Energy Retrieval moves up to 4 Basic Energy from discard to
  hand after discarding 2 cards; Earthen Vessel finds up to 2 Basic Energy after discarding 1; Super Rod shuffles up
  to 3 Pokémon/Basic Energy from discard into the deck.
- [ ] **Step 2: Run** `pnpm --filter @ptcg/cards exec vitest run test/sv-water.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** the scripts (helpers in `src/scripts/util.ts`: `searchDeck`, `isBasicEnergy`).
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Deck test** `gym-lorelei.test.ts`: `assertGymDeck(GYM_DECKS.lorelei, 'leader')` and the name; write
  `lorelei.json`; run — Expected: PASS.
- [ ] **Step 6: Plan test** in `packages/bots/test/plan.test.ts`: `deckPlan(GYM_DECKS.lorelei).attackers` contains
  `'Chien-Pao ex'`; if it fails, add a `DECK_PLANS["Lorelei's Chien-Pao Deck"]` entry (`attackers: ['Chien-Pao ex']`,
  `first: ['Frigibax', 'Baxcalibur']`); run — Expected: PASS.
- [ ] **Step 7: Run** `gym-fuzz.test.ts` — Expected: PASS. **Commit** `git commit -m "Gym: Lorelei plays Chien-Pao ex"`.

### Task 8: Agatha — Gardevoir ex

**Files:**
- Create scripts (registered): `me01/058.ts` Ralts, `me01/059.ts` Kirlia, `sv01/086.ts` Gardevoir ex, `sv04/086.ts`
  Scream Tail, `sv04/160.ts` Counter Catcher, `sv02/173.ts` Bravery Charm, `sv02/171.ts` Artazon — only those with
  non-empty text or that are Trainers
- Modify: `packages/cards/src/decks/gym/agatha.json`; `packages/bots/src/plans.ts` if Step 6 needs it
- Test: `packages/cards/test/sv-psychic.test.ts`, `packages/cards/test/gym-agatha.test.ts` (rewritten),
  `packages/bots/test/plan.test.ts` (one case)

**Deck** ("Agatha's Gardevoir Deck"): 4 Ralts `me01-058`, 3 Kirlia `me01-059`, 2 Gardevoir ex `sv01-086`, 4 Munkidori
`sv06-095`, 1 Scream Tail `sv04-086`, 1 Lillie's Clefairy ex `sv09-056`, 1 Mew ex `sv03.5-151`, 1 Fezandipiti ex
`sv06.5-038`; 4 Professor's Research `sv09-155`, 4 Iono `sv02-185`, 2 Arven `sv01-166`, 4 Ultra Ball `me01-131`,
3 Earthen Vessel `sv04-163`, 3 Rare Candy `me01-125`, 2 Counter Catcher `sv04-160`, 2 Night Stretcher `me01-173`,
2 Nest Ball `sv01-181`, 1 Super Rod `sv02-188`, 1 Secret Box `sv06-163`, 2 Bravery Charm `sv02-173`, 2 Artazon
`sv02-171`; 7 Psychic Energy `mee-005`, 4 Darkness Energy `mee-007`. (Stand-ins for the tournament list's TMs and
Flutter Mane: +1 Rare Candy, +1 Ralts, +1 Kirlia, +1 Bravery Charm.)

- [ ] **Step 1: Write the failing card tests** in `sv-psychic.test.ts`, one per script. Fixed expectations: Gardevoir
  ex's Psychic Embrace attaches a Basic Psychic Energy from the discard pile to a Psychic Pokémon and puts 2 damage
  counters on it, any number of times a turn, never Knocking it Out; Counter Catcher is only playable while the player
  has more Prize cards remaining than the opponent; Bravery Charm gives the Basic Pokémon it is attached to +50 HP;
  Artazon lets each player once a turn put a non-Rule-Box Basic Pokémon from the deck onto the Bench.
- [ ] **Step 2: Run** `pnpm --filter @ptcg/cards exec vitest run test/sv-psychic.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** the scripts.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Deck test** `gym-agatha.test.ts` (leader mode, name), write `agatha.json`, run — Expected: PASS.
- [ ] **Step 6: Plan test**: `deckPlan(GYM_DECKS.agatha).lines['Gardevoir ex']` equals `['Ralts','Kirlia','Gardevoir
  ex']` and attackers include `'Gardevoir ex'` or `'Munkidori'`; add a `DECK_PLANS` entry if needed; run — PASS.
- [ ] **Step 7: Run** `gym-fuzz.test.ts` — PASS. **Commit** `git commit -m "Gym: Agatha plays Gardevoir ex"`.

### Task 9: Balance pass and checks

**Files:**
- Modify: the four deck JSONs or `packages/bots/src/plans.ts` only as tuning needs
- Test: `apps/web/test/frontier-pool.test.ts` (extended)

- [ ] **Step 1: Test** `frontier pool only uses playable cards`: every card of every deck the Battle Frontier pool can
  build is `isPlayable` after the new sets are imported. Run `pnpm --filter @ptcg/web exec vitest run test/frontier-pool.test.ts` —
  Expected: PASS (if it fails, filter the pool by `isPlayable`, then PASS).
- [ ] **Step 2: Probe** `GYM_ONLY=lorelei,bruno,agatha,lance npx tsx scripts/round-robin.ts --probe` (4 shards in
  parallel) — Expected: each leader in 55–65%. Outside the band: change the list within the Global Constraints (counts,
  staples) or the deck plan, rerun; record each change in the ledger. If a band cannot be reached after three tuning
  rounds, stop tuning and report the numbers.
- [ ] **Step 3: Full checks** `pnpm typecheck && pnpm lint && pnpm test` — Expected: all PASS.
- [ ] **Step 4: Commit** `git commit -m "Gym: tune the Kanto Elite Four meta decks"` (if anything changed).
