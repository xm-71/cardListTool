# Johto Gym Challenge, part 2: the last four leaders — design

Date: 2026-10-13 · Status: written, awaiting spec review · Step 4 of 5 in the decks + Johto roadmap · Depends on:
`2026-10-13-johto-gyms-1-design.md` (shipped: region model, unlock, tabs, rewards, first four leaders)

## Goal

Complete the Johto badge case: **Chuck, Jasmine, Pryce and Clair** become real, challengeable Gym Leaders after
Morty. The "Coming soon" tiles go away. Part 3 (Johto Elite Four, Champion Lance, optional Red) is next.

## Success criteria

- The Johto badge case lists eight real leaders in order; each must be beaten in order (Falkner → … → Clair) and
  pays its first-win reward; rematches pay normal bot credits.
- Each new leader plays a real, Gym-legal 60-card deck that the bot plays to the end without errors, and whose
  balance has been measured.
- Nothing changes for Kanto, the first four Johto leaders, saves or rewards already earned.

## Rules

### The leaders

| Leader | Badge | Type | Bot | Deck core (Gym-legal: mark H or later, or any sv03.5 card) |
|---|---|---|---|---|
| Chuck | Storm | Fighting | Hard | Poliwag → Poliwhirl → Poliwrath (sv03.5-060..062), Machop line and Hitmonlee/Hitmonchan (sv03.5, already playable), Mankey → Primeape → Annihilape (sv08-098..100) if they can be scripted |
| Jasmine | Mineral | Metal | Hard | Onix sv03.5-095 → Steelix me01-093, Magnemite → Magneton → Magnezone (me01-045..047), Skarmory sv08-124; Jasmine's Gaze sv08-178 |
| Pryce | Glacier | Water | Hard | Swinub → Piloswine → Mamoswine (me02-023..025), Seel/Dewgong (sv03.5-086/087), Lapras sv03.5-131, Jynx ex sv03.5-124 |
| Clair | Rising | Dragon | Hard | Horsea → Seadra → Kingdra ex (sv03.5-116/117, sv06.5-012), Dratini → Dragonair → Dragonite (sv03.5-147..149) |

- All four use the Hard bot (the "Medium then Hard" decision: Falkner and Bugsy Medium, the rest Hard).
- **Policy for cards that need engine support that does not exist** (a hook the engine lacks, a rule it cannot
  express): leave the card out and use another playable card, exactly as part 1 did. No engine changes in this part.
  Each omission is recorded in the plan ledger.
- Flavour text (intro, win, lose) follows the Kanto and part 1 entries. Each leader gets an original pixel portrait in
  the existing `LOOKS` system, distinct from every other portrait (the portraits test enforces it).
- Decks: 60 cards, ≤ 4 copies per name (basic Energy aside), ≤ 1 ACE SPEC; tuned so their Medium-piloted win rate
  against the premade decks (Easy-piloted) is 40–60% (round-robin), because the real bot is Hard.

### Rewards

- The reward formula from part 1 continues: leader at Johto index `i` pays `150 + 25 × i` credits and one `me02` pack.
  Chuck (4) 250, Jasmine (5) 275, Pryce (6) 300, Clair (7) 325. No change to the formula or `Payout`.

### Screens

- `JOHTO_LEADERS` grows to eight entries; `JOHTO_UPCOMING` is removed and `JOHTO_TOTAL` becomes
  `JOHTO_LEADERS.length` (8). The Johto badge case shows eight leader tiles and no "Coming soon" tiles.
- The Johto intro text drops "More leaders are on their way." and reads "Beat the Johto Gym Leaders in order to earn
  their badges. Badges: n / 8."
- Everything else (tabs, locked state, match setup, game over, rewards screen) is unchanged.

### Bots and registration (CLAUDE.md)

- Each new deck is added to `GYM_DECKS` and to the `packages/bots` gym-fuzz deck count and round-robin targets
  (`[40, 60]`, like Whitney and Morty). `GYM_DECKS` grows from 19 to 23; the economy `gym-decks` test count is
  raised. Gym decks stay out of `DECKS`.

## Code shape

- `packages/cards`: `decks/gym/{chuck,jasmine,pryce,clair}.json`, imported cards, new card scripts under
  `src/scripts/<set>/<number>.ts` (registered in `src/scripts/index.ts`), `GYM_DECKS` entries, one `gym-<leader>.test.ts`
  each (using `assertGymDeck`).
- `apps/web/src/game/gym.ts`: four `Opponent` entries, `JOHTO_UPCOMING` removed, `JOHTO_TOTAL` derived.
- `apps/web/src/game/portraits.ts`: four `LOOKS` entries.
- `apps/web/src/screens/GymChallenge.tsx`: drop the `upcoming` plumbing and the "more leaders" sentence.
- `packages/bots` and `packages/economy` tests and the round-robin targets, as above.

## Tests

- Pure: `leadersOf('johto')` lists the eight leaders in order with all-Hard bots for the last four; rewards for
  indexes 4–7; the order rule from Falkner to Clair; `JOHTO_TOTAL` is 8; portraits exist and differ.
- Profile: a first win over Chuck pays 250 credits and a `me02` pack; Clair pays 325; a rematch pays normal credits.
- Screens: the Johto case shows 8 tiles with no "Coming soon"; Chuck is locked until Morty is beaten; "Badges: n / 8";
  challenging Clair starts a Hard-bot game against her deck.
- Cards/bots: deck validity (`assertGymDeck`), one test per new script, gym-fuzz plays each deck with Easy and Hard
  pilots, round-robin win rates recorded in the PR.
- E2E: at 390 and 1400 px, with every earlier Johto badge, the Johto tab shows eight tiles without sideways scroll and
  Clair's match starts.

## Not in this part

- The Johto Elite Four, Champion Lance and Red (part 3), engine hooks for cards the engine cannot run, Frontier
  integration for Johto leaders.
