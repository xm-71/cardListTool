# Johto Gym Challenge, part 1: region, unlock and the first four leaders — design

Date: 2026-10-13 · Status: design approved in chat, awaiting written-spec review · Step 3 of 5 in the decks + Johto
roadmap · Depends on: the shipped Kanto Gym Challenge, deck ownership and the active deck (steps 1–2)

## Goal

After the player beats the Kanto Champion, Gym Challenge opens a second region, **Johto**. This part adds the region
plumbing, the unlock, and the first four Johto leaders: **Falkner, Bugsy, Whitney, Morty**. Leaders 5–8 (part 4) and
the Johto Elite Four, Champion Lance and optional Red (part 5) reuse the same plumbing.

## Success criteria

- Gym Challenge has Kanto and Johto tabs. Johto is locked, with a hint, until the Kanto Champion has been beaten, and
  open from the start for players who already have.
- The Johto badge case lists all eight leaders in order; only Falkner–Morty can be challenged in this part (the other
  four are listed as "Coming soon", disabled). Each leader must be beaten in order, like Kanto.
- Each new leader plays a real deck built from Gym-legal cards; the bot plays it without errors (fuzz-tested).
- First wins pay the Johto reward; rematches pay normal bot credits, like Kanto.
- Kanto behaviour is unchanged: eight Kanto badges still gate the Elite Four, existing saves load unchanged.

## Rules

### Region model

- `gym.badges` stays one list of earned badge ids; Johto ids (`falkner`, `bugsy`, `whitney`, `morty`, later `chuck`,
  `jasmine`, `pryce`, `clair`) are appended to it. No save migration.
- `LEADERS` stays the Kanto list. A new `JOHTO_LEADERS` (8 entries; 4 playable now) sits beside it, and
  `type Region = 'kanto' | 'johto'`; `leadersOf(region)` returns the list.
- `nextGymIndex`, `gymStatus`, `canChallenge` and `applyGymResult` take the region's leader list (default Kanto) so
  each region has its own "in order" rule. `canStartElite` counts Kanto badges only.
- `normalizeGym` keeps badge ids from both lists.
- **Unlock:** Johto is open when `gym.hallOfFame.length > 0`.
- Other readers of `LEADERS` (Trainer Card, town building flag, `townStatus`, `describe`, `GymGameOver`, `gymMatch`,
  Frontier opponents/save) keep Kanto semantics, except where a Johto leader id must be looked up (`GymGameOver`,
  `describe`, `gymMatch`): they search both lists. The town flag and Trainer Card keep showing Kanto badges (x / 8).

### Rewards

- First win over Johto leader at index `i`: **150 + 25 × i credits** and **one pack from the newest Mega Evolution
  set** (`JOHTO_PACK_SET = 'me02'`, a constant). Kanto's reward is unchanged. `Payout` gains the pack's set id so the
  profile opens the right pack; the existing reward screens show the cards.
- Rematches pay the normal bot credits (Medium/Hard bot rates), as in Kanto.

### The leaders

| Leader | Badge | Type | Bot | Deck core (all Gym-legal: mark H+ or sv03.5) |
|---|---|---|---|---|
| Falkner | Zephyr | Flying (Colorless energy) | Medium | Pidgey line (sv03.5), Hoothoot/Noctowl (sv07), Pidgeot sv03.5-018 |
| Bugsy | Hive | Grass/Metal | Medium | Scyther → Scizor ex sv05-111, Heracross, Ledyba, Spinarak lines |
| Whitney | Plain | Colorless | Hard | Miltank me01-106, Clefairy/Clefable sv06, Lillie's Clefairy ex sv09-056, Snorlax |
| Morty | Fog | Ghost (Psychic/Darkness) | Hard | Mega Gengar ex line me02-054..056, Misdreavus/Mismagius ex, Morty's Conviction sv05-155 |

- Flavour text (intro, win, lose) follows the game's mix of the in-game lines, written in the style of the Kanto
  entries.
- Falkner's Supporter, Pidgeot ex and Natu/Xatu are regulation mark G outside the 151 set and are **not** used.
- Decks are 60 cards, obey the normal deck rules, and are tuned so the Medium/Hard bots win a fair share of
  matches against the premade decks (round-robin check), without being unbeatable.
- Cards the decks need that are not in the card data are imported; cards without a script get one. The research list
  is in the plan.

### Screens

- **Gym Challenge** gets Kanto and Johto tabs in the `actions` slot beside Back (the Poké Mart pattern); the active
  tab is kept while the player stays on the screen. Kanto's content is unchanged.
- **Johto tab, locked:** a note, "Beat the Kanto Champion to travel to Johto.", and the badge case is not shown.
- **Johto tab, open:** an intro box ("Johto Gym Challenge: beat the Gym Leaders in order. Badges: n / 8"), the badge
  case with tiles in the Kanto style (portrait, name, type, badge, "First win: N credits + a Mega Evolution pack"),
  Challenge / Rematch / Locked buttons, and "Coming soon" tiles for the four leaders not built yet. The Elite Four
  and Hall of Fame panels stay on the Kanto tab.
- **Match setup, game over and rewards** reuse the existing components (active-deck panel from step 2; locked
  Elite deck not involved).
- Phone: tabs wrap beside Back; two-column badge grid as in Kanto; no sideways scroll at 390 px.
- Collector mode closes Gym Challenge, as before.

### Bots and registration (CLAUDE.md)

- The four leader decks are added to `GYM_DECKS` (`packages/cards/src/gym.ts`, `decks/gym/*.json`) and to
  `packages/bots` fuzz and balance (`test/gym-fuzz.test.ts`, `test/fuzz.test.ts`, `scripts/round-robin.ts`).
- Gym decks are not part of the bots' random Duel pool (`DECKS`): that pool is premade decks only, so no `DECKS`
  entry is added.

## Code shape

- `apps/web/src/game/gym.ts`: `Region`, `JOHTO_LEADERS`, `leadersOf`, region-aware helpers, `johtoUnlocked(gym)`,
  `johtoBadgeReward(index)`, `normalizeGym` ids; `Payout.set`.
- `apps/web/src/profile/useProfile.ts`: `openRewardPacks` uses the payout's set; `applyGymResult` called with the
  leader's region.
- `apps/web/src/game/gymMatch.ts`, `describe.ts`, `ui/GymGameOver.tsx`: find a leader across both regions.
- `apps/web/src/screens/GymChallenge.tsx`: tabs, `JohtoGyms` panel (or a shared `LeaderGrid` taking the region).
- `packages/cards`: four deck JSON files, `GYM_DECKS` entries, imported cards and scripts.
- `packages/bots`: fuzz and round-robin entries.

## Tests

- Pure: region helpers (order rule per region, `canStartElite` ignores Johto badges), `johtoUnlocked`, rewards,
  `applyGymResult` for a Johto leader, `normalizeGym` keeps Johto ids and drops unknown ones.
- Profile: a Johto first win adds the badge, pays the credits and opens a `me02` pack; a rematch pays the normal
  credits only; Kanto rewards still open a 151 pack.
- Screens: locked Johto tab and hint; open tab for a player with a Hall of Fame entry; Challenge Falkner starts a
  Medium-bot game with Falkner's deck, Whitney a Hard-bot game; later leaders are "Coming soon" and disabled;
  Kanto tab unchanged; Collector mode closes Gym Challenge.
- Cards/bots: each deck validates (60 cards, rules, Gym-legal), each new card script has a unit test, gym-fuzz plays
  each deck to the end with no engine errors, round-robin win rates are recorded in the PR.
- E2E: at 390 and 1400 px, unlock Johto (profile with a Hall of Fame entry), open the tab, check no sideways scroll,
  challenge Falkner and start the match.

## Not in this part

- Leaders 5–8 (Chuck, Jasmine, Pryce, Clair), the Johto Elite Four, Champion Lance, Red (parts 4 and 5).
- Using Johto leaders in the Battle Frontier, a second badge case on the Trainer Card or town, new town buildings.
