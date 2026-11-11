# Meta decks, part 2: Blue ×3 and Red (one PR) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Blue's three Champion decks (Fire, Water, Grass) and Red play type-matched meta decks, and the two sets they
need that are not imported yet (Obsidian Flames `sv03`, Chaos Rising `me04`) are imported whole and sold as packs.

**Architecture:** Same as part 1 (`2026-10-16-meta-decks-pr1.md`): card data comes from TCGdex through the importer fed by
`packages/cards/src/sets.json`; leader decks are JSON under `packages/cards/src/decks/gym/` (ids unchanged); new card
behaviour is one script per card under `packages/cards/src/scripts/<set>/<number>.ts`, registered in
`src/scripts/index.ts`; packs are `PACKS` entries in `packages/economy/src/packs.ts`.

**Tech Stack:** TypeScript, vitest, pnpm workspaces, TCGdex REST API (`https://api.tcgdex.net/v2/en`).

**Spec:** `docs/superpowers/specs/2026-10-16-meta-decks-sv-me-design.md` (this plan is its delivery 2). Rulings made while
planning, which override the spec's table where they differ:
- **Blue Water plays Mega Greninja ex** (player's choice). Mega Greninja ex is in `me04`, which is not imported, so
  `me04` is imported whole (spec rule: any set a deck draws from is imported whole and sold as packs).
- **Blue Fire needs `sv03`:** Pidgeot ex (`sv03-164`) and the tournament Charizard ex (`sv03-125`) are in Obsidian
  Flames, which is not imported, so `sv03` is imported whole too.
- **Lists are drafted, not copied.** Tournament-result sites are unreachable from the build environment (only
  TCGdex is), so each list is drafted from its archetype and checked card by card against TCGdex and the engine.
  The PR says so. The balance pass (Task 7) is what tunes them, as in part 1.

## Global Constraints

- No changes to `packages/engine`. A card the engine cannot run is replaced by a stand-in and listed in the PR.
- Leader decks: 60 cards, every card playable (`isPlayable`), at most 4 of a name (Basic Energy excepted), at most 1
  ACE SPEC; cards with regulation mark D or later, or from `sv03.5` or an `me*` set (`assertGymDeck(deck, 'leader')`).
- No Sword & Shield (`swsh*`) cards.
- Deck ids, leader ids, leader difficulty (Blue Medium, Red Hard), rewards and the player's own deck rules do not change.
  Blue keeps choosing the deck that counters the player's starter (`championDeckFor`).
- Whole sets: `sv03` and `me04` are in `sets.json`, imported in full, with a shop pack each (`sv03` era `'sv'`, `me04`
  era `'mega'`). Only the cards these decks use get scripts; the rest are "isn't playable yet" (backlog item exists).
- Probe bands (win rate of the leader's deck with its in-game bot, `--probe 3`, 54 games): Blue ×3 60–70%, Red 65–75%.
  After three tuning rounds without reaching a band, stop and report the numbers (as in part 1).
- Per `CLAUDE.md`: deck ids are unchanged, so the bot lists (`gym-fuzz`, `LEADER_DIFFICULTY`) already carry these decks;
  confirm `gym-fuzz.test.ts` passes for them.
- `pnpm lint`, `pnpm typecheck` and `pnpm test` pass before every push (run `pnpm lint` too, not only tests).

## Review Focus

Failure modes the tests per task do not name but a player would meet; each has a test in the task that owns it.

1. **A set card TCGdex serves oddly breaks the import** (a Trainer without a type, a missing field in a new `me04`
   card): the normalizer must name the card (Task 1 test).
2. **Mega Greninja ex's Mortal Shuriken** puts 6 damage *counters* (60) on any one opposing Pokémon — Bench included, no
   Weakness or Resistance — only from the Active Spot, only by discarding a Basic {W} Energy from the hand, and only
   once a turn (Task 5 tests).
3. **Pidgeot ex's Quick Search** finds any card, not only a Pokémon, and is once per turn per Pokémon (Task 3).
4. **Charizard ex's Infernal Reign** triggers only when it evolves from the hand, attaches at most 3 {R} Energy from the
   deck "in any way you like", and shuffles (Task 3).
5. **Meganium's Wild Growth** makes each Basic {G} Energy count as two for attack costs everywhere, and does not stack
   with a second Meganium; the bots' own Energy counting must agree (Tasks 4 and 7).

## Delivery

One PR from the dev branch reset to `master`: Tasks 1–7, in order. Tasks 1–2 (sets and packs) are first so every later
task can use the cards; each task commits on its own.

## File structure

- `packages/cards/src/sets.json`, `src/data/*.json` (generated): two more sets.
- `packages/cards/src/sets.ts`: `sv03` joins the `SV` era set.
- `packages/economy/src/packs.ts`: two `PACKS` entries.
- `packages/cards/src/scripts/**`: one file per newly scripted card, plus `index.ts` entries.
- `packages/cards/src/decks/gym/{blue-fire,blue-water,blue-grass,red}.json`: replaced.
- `packages/cards/test/{sv-fire,sv-grass,me04-water,sv-lightning}.test.ts`: card tests (one file per task).
- `packages/cards/test/meta-leader-decks.test.ts`: deck tests (leader pool, exact lists) for the four decks.
- `packages/economy/test/gym-decks.test.ts`: `META_LEADERS` gains the four ids.
- `packages/bots/scripts/round-robin.ts`: `PROBE_TARGETS` gains four bands; `GYM_TARGETS` loses the Blue ×3 entries.
- `packages/bots/test/plan.test.ts`: one plan case per deck; `packages/bots/src/plans.ts` only if a plan needs an override.
- `apps/web/src/game/gym.ts`: Red's `type` label.

---

### Task 1: Import `sv03` and `me04` whole

**Files:**
- Modify: `packages/cards/src/sets.json`, `packages/cards/src/sets.ts`, `packages/cards/src/data/cards.json` and
  `data/sets.json` (generated), `packages/cards/src/normalize.ts` only if a card fails to normalize
- Test: `packages/cards/test/sets.test.ts`; `packages/cards/test/normalize.test.ts` for any normalizer change;
  `packages/cards/test/playable.test.ts` if its era list needs `sv03`

**Interfaces:**
- Produces: full card data for `sv03` (230 cards, TCGdex `cardCount.total`) and `me04` (122); `sv03` counts as Scarlet &
  Violet era (`'sv'`), `me04` as `'mega'` (the default for unlisted sets).

- [ ] **Step 1: Write the failing tests** in `sets.test.ts`: extend its `SIZES` with `sv03: 230, me04: 122` (its three
  existing tests then cover whole-set import, normalization and shop-set membership), and add
  `sv03 is Scarlet & Violet era and me04 is Mega era` asserting `SETS.find(s => s.id === 'sv03')?.era === 'sv'` and
  `…'me04'…era === 'mega'`.
- [ ] **Step 2: Run** `pnpm --filter @ptcg/cards exec vitest run test/sets.test.ts` — Expected: FAIL (0 cards, no era).
- [ ] **Step 3: Add `'sv03'` and `'me04'` to `sets.json`, add `'sv03'` to the `SV` set in `sets.ts`, and run**
  `pnpm --filter @ptcg/cards import-cards`. If the normalizer throws, the error names the card: extend `normalize.ts` for
  that case and add a `normalize.test.ts` case naming the card, then rerun. (Review Focus 1.)
- [ ] **Step 4: Run** `pnpm --filter @ptcg/cards test` and `pnpm --filter @ptcg/economy test` — Expected: PASS (fix any
  existing test that counts all cards or all packs by updating its number, saying so in the commit).
- [ ] **Step 5: Web build size:** run `pnpm --filter @ptcg/web build` on `master` (via `git stash` or a worktree) and
  after; record the main chunk and the bot-worker chunk sizes in the commit message and the PR. Expected: builds; growth
  is reported (part 1 grew 1,065 kB for ~2,000 cards; expect roughly +350 cards ≈ +180 kB).
- [ ] **Step 6: Commit** `git commit -m "Cards: import Obsidian Flames and Chaos Rising whole"`.

### Task 2: Shop packs for `sv03` and `me04`

**Files:**
- Modify: `packages/economy/src/packs.ts` (`PACKS`; the era slot-10 rates only if a rarity is unpullable)
- Modify: web shop tests whose pack counts change (`apps/web/test/classic.test.tsx` Mega packs, `apps/web/test/sv151.test.tsx`
  Scarlet & Violet packs — find them by searching for the current counts, 4 and 9)
- Test: `packages/economy/test/packs.test.ts`

**Interfaces:**
- Consumes: the imported sets (Task 1).
- Produces: `PACKS` entries `sv03` Obsidian Flames (era `'sv'`) and `me04` Chaos Rising (era `'mega'`), newest-first order
  like the existing entries.

- [ ] **Step 1: Write the failing tests** in `packs.test.ts`: extend the existing `the new sets are sold as packs` and
  `every rarity in each new shop set can be pulled` tests with `sv03` and `me04` (era given above).
- [ ] **Step 2: Run** `pnpm --filter @ptcg/economy exec vitest run test/packs.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** the two `PACKS` entries. If a rarity is unpullable, add it to the era's slot-10 rates with
  weight 0.03 taken from `Rare`, keeping the rate-frequency tests green.
- [ ] **Step 4: Run** `pnpm --filter @ptcg/economy test` and `pnpm --filter @ptcg/web test` — Expected: PASS (update the
  web shop tests' pack counts: Mega 4 → 5, Scarlet & Violet 9 → 10, saying so in the commit).
- [ ] **Step 5: Commit** `git commit -m "Economy: packs for Obsidian Flames and Chaos Rising"`.

### Task 3: Blue (Fire) — Charizard ex / Pidgeot ex

**Files:**
- Create scripts (registered): one per card in the deck that is not playable yet and has non-empty attack or Ability
  text or is a Trainer. Expected set: `sv03/027` Charmeleon, `sv03/125` Charizard ex, `sv03/162` Pidgey, `sv03/163`
  Pidgeotto, `sv03/164` Pidgeot ex. Find the real set with the Step 1 listing; a vanilla card needs none.
- Modify: `packages/cards/src/decks/gym/blue-fire.json`; `packages/bots/src/plans.ts` if Step 6 needs it
- Test: `packages/cards/test/sv-fire.test.ts` (card tests), `packages/cards/test/meta-leader-decks.test.ts` (deck test),
  `packages/bots/test/plan.test.ts` (one case)

**Deck** ("Blue's Charizard Deck"): 3 Charmander `sv03-026`, 1 Charmeleon `sv03-027`, 3 Charizard ex `sv03-125`, 2 Pidgey
`sv03-162`, 1 Pidgeotto `sv03-163`, 2 Pidgeot ex `sv03-164`, 1 Mew ex `sv03.5-151`, 1 Fezandipiti ex `sv06.5-038`;
4 Arven `sv01-166`, 2 Boss's Orders `me01-114`, 2 Iono `sv02-185`, 2 Professor's Research `sv09-155`, 2 Lillie's
Determination `me01-119`; 4 Rare Candy `me01-125`, 3 Ultra Ball `me01-131`, 4 Nest Ball `sv01-181`, 2 Buddy-Buddy
Poffin `me01-167`, 1 Super Rod `sv02-188`, 1 Night Stretcher `me01-173`, 1 Switch `me01-130`, 1 Prime Catcher
`sv05-157`; 1 Air Balloon `me01-166`; 16 Fire Energy `mee-002` (= 60).

- [ ] **Step 1: List what is unplayable:** with a scratch test (not committed) print, for each id in the deck,
  `isPlayable(registry.defs[id], registry)`; every `false` with attack or Ability text needs a script (Interfaces above is
  the expectation). Look up each card's text in `src/data/cards.json`.
- [ ] **Step 2: Write the failing card tests** in `sv-fire.test.ts`, one per script, each asserting the card's text in a
  built position. Fixed expectations: **Pidgeot ex's Quick Search** puts any 1 card from the deck into the hand (a Trainer
  and an Energy are offered too) and then shuffles; once per turn for each Pidgeot ex; **Charizard ex's Infernal Reign**,
  when it evolves from the hand, attaches up to 3 Basic {R} Energy from the deck to the player's Pokémon in any split and
  shuffles — and does nothing when Charizard ex is put into play any other way; **Charizard ex's Burning Darkness** does
  its printed damage plus the printed bonus per Prize card the opponent has taken (take the numbers from
  `cards.json`). Pidgey/Pidgeotto/Charmeleon: one test per non-vanilla attack. (Review Focus 3 and 4.)
- [ ] **Step 3: Run** `pnpm --filter @ptcg/cards exec vitest run test/sv-fire.test.ts` — Expected: FAIL.
- [ ] **Step 4: Implement** the scripts (helpers in `src/scripts/util.ts`: `searchDeck`, `isBasicEnergy`, `evolveFromHand`
  hooks as in other Stage 2 scripts such as `me01/` ones; `onEvolveFromHand` for Infernal Reign), register them, and run
  the tests — Expected: PASS.
- [ ] **Step 5: Deck test** in `meta-leader-decks.test.ts`: `assertGymDeck(GYM_DECKS['blue-fire'], 'leader')`, the name,
  and the exact count map; write `blue-fire.json`; add `'blue-fire'` to `META_LEADERS` in
  `packages/economy/test/gym-decks.test.ts`; run both test files — Expected: PASS.
- [ ] **Step 6: Plan test** in `packages/bots/test/plan.test.ts`: `deckPlan(GYM_DECKS['blue-fire']).lines['Charizard ex']`
  equals `['Charmander','Charmeleon','Charizard ex']` and `attackers` contains `'Charizard ex'`; if it fails, add a
  `DECK_PLANS["Blue's Charizard Deck"]` entry (`attackers: ['Charizard ex']`, `first: ['Pidgeot ex']`); run — PASS.
- [ ] **Step 7: Run** `pnpm --filter @ptcg/bots exec vitest run test/gym-fuzz.test.ts -t blue-fire` — Expected: PASS.
  **Commit** `git commit -m "Gym: Blue plays Charizard ex (Fire)"`.

### Task 4: Blue (Grass) — Teal Mask Ogerpon ex / Meganium

**Files:**
- Create scripts (registered): `me01/009` Bayleef, `me01/010` Meganium (plus any other unplayable, non-vanilla card the
  Step 1 listing finds; Teal Mask Ogerpon ex `sv06-025` and Chikorita `me01-008` are already playable)
- Modify: `packages/cards/src/decks/gym/blue-grass.json`; `packages/bots/src/plans.ts` if Step 6 needs it
- Test: `packages/cards/test/sv-grass.test.ts`, `meta-leader-decks.test.ts`, `plan.test.ts` (one case)

**Deck** ("Blue's Ogerpon Deck"): 4 Teal Mask Ogerpon ex `sv06-025`, 4 Chikorita `me01-008`, 3 Bayleef `me01-009`,
3 Meganium `me01-010`, 1 Fezandipiti ex `sv06.5-038`; 4 Arven `sv01-166`, 3 Professor's Research `sv09-155`, 2 Iono
`sv02-185`, 2 Boss's Orders `me01-114`; 4 Nest Ball `sv01-181`, 4 Ultra Ball `me01-131`, 3 Rare Candy `me01-125`,
3 Buddy-Buddy Poffin `me01-167`, 2 Night Stretcher `me01-173`, 1 Super Rod `sv02-188`, 1 Switch `me01-130`; 16 Grass
Energy `mee-001` (= 60).

- [ ] **Step 1: List what is unplayable** as in Task 3 Step 1 — expect Bayleef and Meganium.
- [ ] **Step 2: Write the failing card tests** in `sv-grass.test.ts`: **Meganium's Wild Growth** — a Pokémon with one Basic
  {G} Energy attached pays a `{G}{G}` attack cost; two Meganium in play do not give a third copy of the effect (a Basic
  {G} Energy still counts as exactly 2, so one Energy cannot pay `{G}{G}{G}`); a Special Energy is not doubled. Use the
  engine's attack legality (`getLegalActions` offers the attack or not). **Meganium's Solar Beam** does its printed
  damage. **Bayleef**: one test per non-vanilla attack. (Review Focus 5.) Check how another cost-changing script (e.g.
  `modifyAttackCost` or an energy-provides hook in `packages/engine/src/energy.ts`) is expressed before choosing the hook;
  if the engine has no hook that can make an Energy provide two, rule on the smallest stand-in (e.g. `modifyAttackCost`
  removing one `{G}` from the cost for every Basic {G} Energy attached, capped at the cost) and ledger it.
- [ ] **Step 3: Run** `pnpm --filter @ptcg/cards exec vitest run test/sv-grass.test.ts` — Expected: FAIL.
- [ ] **Step 4: Implement** the scripts, register them, run the tests — Expected: PASS.
- [ ] **Step 5: Deck test, `blue-grass.json`, `META_LEADERS`** as in Task 3 Step 5 (`'blue-grass'`).
- [ ] **Step 6: Plan test:** `deckPlan(GYM_DECKS['blue-grass']).lines['Meganium']` equals
  `['Chikorita','Bayleef','Meganium']` and `attackers` includes `'Teal Mask Ogerpon ex'` or `'Meganium'`; override in
  `DECK_PLANS` if needed; run — PASS.
- [ ] **Step 7: Run** `gym-fuzz.test.ts -t blue-grass` — PASS. **Commit** `git commit -m "Gym: Blue plays Teal Mask Ogerpon ex and Meganium (Grass)"`.

### Task 5: Blue (Water) — Mega Greninja ex

**Files:**
- Create scripts (registered): `me04/020` Froakie, `me04/021` Frogadier, `me04/022` Mega Greninja ex, `me03/021` Mega
  Starmie ex (only those the Step 1 listing finds unplayable and non-vanilla; `me03-020` Staryu is playable)
- Modify: `packages/cards/src/decks/gym/blue-water.json`; `packages/bots/src/plans.ts` if Step 6 needs it
- Test: `packages/cards/test/me04-water.test.ts`, `meta-leader-decks.test.ts`, `plan.test.ts` (one case)

**Deck** ("Blue's Mega Greninja Deck"): 4 Froakie `me04-020`, 3 Frogadier `me04-021`, 3 Mega Greninja ex `me04-022`,
2 Staryu `me03-020`, 2 Mega Starmie ex `me03-021`, 1 Fezandipiti ex `sv06.5-038`; 4 Professor's Research `sv09-155`,
2 Iono `sv02-185`, 2 Boss's Orders `me01-114`, 2 Arven `sv01-166`; 4 Ultra Ball `me01-131`, 4 Nest Ball `sv01-181`,
3 Rare Candy `me01-125`, 3 Earthen Vessel `sv04-163`, 2 Buddy-Buddy Poffin `me01-167`, 1 Night Stretcher `me01-173`,
1 Super Rod `sv02-188`, 1 Switch `me01-130`; 16 Water Energy `mee-003` (= 60). If Mega Starmie ex cannot be scripted
in this task's scope, use 2 more Staryu stand-ins' worth of Water Energy and a second Frogadier line (ruling, ledgered).

- [ ] **Step 1: List what is unplayable** as in Task 3 Step 1; read the real text of each in `cards.json`
  (`me04-022`: Ninja Spinner `{W}{W}` 120+, "You may put a {W} Energy attached to this Pokémon into your hand and have
  this attack do 80 more damage"; Mortal Shuriken: "Once during your turn, if this Pokémon is in the Active Spot, you may
  discard a Basic {W} Energy card from your hand in order to use this Ability. Place 6 damage counters on 1 of your
  opponent's Pokémon."; 350 HP, Lightning Weakness, Retreat 1, evolves from Frogadier).
- [ ] **Step 2: Write the failing card tests** in `me04-water.test.ts`. Fixed expectations (Review Focus 2): **Mortal
  Shuriken** puts exactly 6 damage counters (60) on a chosen opposing Pokémon — a Benched target takes 60 and its
  Weakness is ignored — discarding one Basic {W} Energy from the hand; it is not available from the Bench, not without a
  Basic {W} Energy in hand, and not twice in a turn; it can put counters that Knock Out a Pokémon (Prizes taken).
  **Ninja Spinner**: with the choice taken, 200 damage and one {W} Energy back in the hand; declined, 120 and the Energy
  stays. **Froakie/Frogadier/Mega Starmie ex**: one test per non-vanilla attack or Ability.
- [ ] **Step 3: Run** `pnpm --filter @ptcg/cards exec vitest run test/me04-water.test.ts` — Expected: FAIL.
- [ ] **Step 4: Implement** the scripts, register them, run the tests — Expected: PASS.
- [ ] **Step 5: Deck test, `blue-water.json`, `META_LEADERS`** as in Task 3 Step 5 (`'blue-water'`).
- [ ] **Step 6: Plan test:** `deckPlan(GYM_DECKS['blue-water']).lines['Mega Greninja ex']` equals
  `['Froakie','Frogadier','Mega Greninja ex']` and `attackers` contains `'Mega Greninja ex'`; override in
  `DECK_PLANS` if needed (`first: ['Froakie','Frogadier']`); run — PASS.
- [ ] **Step 7: Run** `gym-fuzz.test.ts -t blue-water` — PASS. **Commit** `git commit -m "Gym: Blue plays Mega Greninja ex (Water)"`.

### Task 6: Red — Miraidon ex / Iron Hands ex

**Files:**
- Create scripts (registered): `sv01/081` Miraidon ex, `sv04/070` Iron Hands ex, `sv03.5/145` Zapdos ex, `sv01/170`
  Electric Generator (the cards the Step 1 listing finds unplayable and non-vanilla)
- Modify: `packages/cards/src/decks/gym/red.json`; `apps/web/src/game/gym.ts` (Red's `type` becomes `'Lightning'`);
  `packages/bots/src/plans.ts` if Step 6 needs it
- Test: `packages/cards/test/sv-lightning.test.ts`, `meta-leader-decks.test.ts`, `plan.test.ts` (one case)

**Deck** ("Red's Miraidon Deck"): 4 Miraidon ex `sv01-081`, 3 Iron Hands ex `sv04-070`, 2 Zapdos ex `sv03.5-145`,
1 Mew ex `sv03.5-151`, 1 Squawkabilly ex `sv02-169`, 1 Fezandipiti ex `sv06.5-038`; 3 Arven `sv01-166`, 2 Boss's
Orders `me01-114`, 3 Iono `sv02-185`, 3 Professor's Research `sv09-155`; 4 Electric Generator `sv01-170`, 4 Nest Ball
`sv01-181`, 3 Ultra Ball `me01-131`, 2 Switch `me01-130`, 1 Prime Catcher `sv05-157`, 2 Night Stretcher `me01-173`;
1 Air Balloon `me01-166`; 20 Lightning Energy `mee-004` (= 60).

- [ ] **Step 1: List what is unplayable** as in Task 3 Step 1.
- [ ] **Step 2: Write the failing card tests** in `sv-lightning.test.ts`. Fixed expectations: **Miraidon ex's Tandem Unit**
  puts up to 2 Basic {L} Pokémon from the deck onto the Bench (as many as the Bench has room for), shuffles, once per
  turn; **Photon Blaster** does 220 and the attacker cannot attack on the next turn; **Iron Hands ex's Amp You Very
  Much** takes 1 extra Prize card only if the attack Knocks Out the Defending Pokémon; **Zapdos ex's Multishot
  Lightning** does 120 plus 90 to a Benched Pokémon that has damage counters (no Weakness/Resistance for the Bench)
  and its Voltaic Float gives no Retreat Cost while it has a {L} Energy; **Electric Generator** reveals the top 5 cards
  and attaches up to 2 {L} Energy found there to Benched {L} Pokémon, then puts the rest on the bottom (check the real
  text in `cards.json` before asserting; it is playable only with a Benched {L} Pokémon if the text says so).
- [ ] **Step 3: Run** `pnpm --filter @ptcg/cards exec vitest run test/sv-lightning.test.ts` — Expected: FAIL.
- [ ] **Step 4: Implement** the scripts, register them, run the tests — Expected: PASS.
- [ ] **Step 5: Deck test, `red.json`, `META_LEADERS`** as in Task 3 Step 5 (`'red'`); also change Red's `type` label in
  `gym.ts` to `'Lightning'` (search the web tests for the old `'Fire + Lightning'` text and update any that assert it).
- [ ] **Step 6: Plan test:** `deckPlan(GYM_DECKS.red).attackers` contains `'Miraidon ex'` or `'Iron Hands ex'`; override in
  `DECK_PLANS` if needed; run — PASS.
- [ ] **Step 7: Run** `gym-fuzz.test.ts -t red` — PASS. **Commit** `git commit -m "Gym: Red plays Miraidon ex and Iron Hands ex"`.

### Task 7: Balance pass for Blue ×3 and Red

**Files:**
- Modify: the four deck JSONs and their expected counts in `meta-leader-decks.test.ts`, or `packages/bots/src/plans.ts`,
  only as tuning needs
- Modify: `packages/bots/scripts/round-robin.ts` — add to `PROBE_TARGETS`: `'blue-fire'`, `'blue-water'`,
  `'blue-grass'`: `[60, 70]`, `red`: `[65, 75]`; delete the `GYM_TARGETS` entries for `blue-fire`, `blue-water`,
  `blue-grass` (measured by `--probe` now; `red` has none)

- [ ] **Step 1: Probe** each leader alone in the background (`GYM_ONLY=<id> npx tsx scripts/round-robin.ts --probe 3`;
  four processes in parallel, redirect output to files, wait for completion notifications — a foreground run is cut off
  at 10 minutes). Expected: each in its band. Outside: change the list within the Global Constraints (counts, staples) or
  the deck plan, rerun, record every change (and the win rate before and after) in the ledger. After three rounds
  without reaching a band, stop and report the numbers. A change that makes a deck clearly worse is reverted, not kept.
- [ ] **Step 2: Bot check for Meganium:** if Blue (Grass) is far below band, check the bot's own Energy counting
  (`provides` in `packages/bots/src/smart.ts`) agrees with Wild Growth (Review Focus 5) before tuning the list; fix with a
  failing bot test first if it does not.
- [ ] **Step 3: Full checks:** `pnpm typecheck && pnpm lint && pnpm test` — Expected: all PASS.
- [ ] **Step 4: Commit** `git commit -m "Gym: tune Blue and Red"` (if anything changed).

## Self-review notes

- Spec coverage: delivery 2 (Blue ×3, Red, their sets, bands, plan overrides, `--probe` bands) is Tasks 1–7; the risks
  (stand-ins flagged at resolve time, lists changing on lookup, `cards.json` growth, bot numbers flattering decks) are
  handled in Tasks 3–7 and the PR text. Part 1's rulings (no Technical Machines, no Flutter Mane) are not needed here.
- Out of scope, unchanged: V / VMAX / VSTAR (spec 2), Sword & Shield decks (spec 3), the Johto Elite Four decks (delivery
  3, own plan), making every card of the imported sets playable (backlog).
