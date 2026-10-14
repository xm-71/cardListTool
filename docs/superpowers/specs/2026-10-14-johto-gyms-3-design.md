# Johto Gym Challenge, part 3: Elite Four, Champion Lance and Red — design

Date: 2026-10-14 · Status: written, awaiting spec review · Step 5 of 5 in the decks + Johto roadmap · Depends on:
parts 1 and 2 (shipped: region model, unlock, tabs, rewards, all eight Johto leaders) and the Kanto Elite Four run

## Goal

Beating all eight Johto badges opens the **Johto Elite Four** (Will, Koga, Bruno, Karen) and **Champion Lance**, run the
same way as Kanto's: one locked deck, five matches in a row, a loss ends the run. Beating Lance adds a Johto Hall of
Fame entry and unlocks **Red**, an optional extra fight. Delivered as two PRs: **3a** the Elite Four and Lance, **3b** Red.

## Success criteria

- With 8 Johto badges the Johto tab offers "Start Elite Four"; the run plays Will → Koga → Bruno → Karen → Lance with
  the deck locked at the start, like Kanto. A loss, quit or reload mid-match ends the run; a draw replays the match.
- Beating Lance records a Johto Hall of Fame entry and pays the Johto Champion reward (first time more than later).
- Johto Elite and Kanto Elite never interfere: one run at a time, a Kanto Hall of Fame entry still unlocks Johto, and
  Kanto behaviour, rewards and saves do not change.
- After the Johto Champion, Red can be fought from the Johto tab; the first win pays a big reward, later wins pay
  normal credits.
- Every new deck plays to the end under fuzzing, and its balance has been measured.

## Rules

### Region-aware Elite run

- `EliteRun` gains `region: Region` (missing in older saves = `'kanto'`). `stage` indexes that region's Elite list
  (`ELITE` for Kanto, new `JOHTO_ELITE` for Johto); the champion is the last entry (`CHAMPION_STAGE` is Kanto's;
  `championStage(region)` generalises it). Only one run exists at a time (`gym.run`).
- `canStartElite(badges, region = 'kanto')` needs all eight leaders of that region. `startRun(g, deck, region)` refuses
  when a run already exists. The other region's Elite panel shows "Finish your {region} run first." while a run is open.
- `HallOfFameEntry` gains `region?: Region` (missing = Kanto). `kantoChampion(g)` is true when some entry is Kanto's;
  **`johtoUnlocked` and the town's champion flag use `kantoChampion`**, not "any entry". `johtoChampion(g)` is true
  when some entry is Johto's. The Kanto Hall of Fame lists Kanto entries, the Johto tab lists Johto entries.
- Match context: `{ kind: 'elite', stage, region?, deckName, cover }` (missing region = Kanto). `describe`,
  `GymGameOver`, `startEliteMatch`, `recordElite`, `beginEliteMatch`, `abandonUnfinishedRun` and `applyEliteResult`
  take the region from the run or the context.

### The Johto Elite Four and Champion

| Opponent | Type | Bot | Deck core (Gym-legal: mark H or later, or any sv03.5 card) |
|---|---|---|---|
| Will | Psychic | Hard | Slowpoke → Slowbro/Slowking (sv03.5-079/080, sv07-058), Exeggcute → Exeggutor, Jynx ex, Espeon ex line sv08.5-034 if scriptable |
| Koga | Poison | Hard | Zubat → Golbat → Crobat (sv06.5-027..029), Pineco → Forretress (sv05-002/110), Venonat → Venomoth |
| Bruno | Fighting | Hard | Machop line, Hitmonlee, Hitmonchan, Hitmontop me02.5-102, Steelix me01-093 |
| Karen | Darkness | Hard | Umbreon ex sv08.5-060 and Eevee sv08.5-074, Houndour → Houndoom sv08.5-062/063, Murkrow → Honchkrow me02-057/058, Mega Gengar line |
| Champion Lance | Dragon | Hard | Dragonite line, Mega Dragonite ex me02.5-152, Gyarados, Charizard ex, Aerodactyl sv03.5-142 with Antique Old Amber sv03.5-154 |

- All five use the Hard bot. **Lance plays one fixed deck** (no counter-pick like Kanto's Blue).
- Policy for cards that need engine support that does not exist: leave them out and use another playable card, as in
  parts 1 and 2; each omission is a `Ruling:` in the plan ledger. No engine changes.
- Ids: `will`, `johto-koga`, `johto-bruno`, `karen`, `johto-lance` (Kanto already owns `koga`, `bruno`, `lance`). The
  display names stay "Koga", "Bruno" and "Champion Lance". Each gets an original pixel portrait (distinct from every
  other portrait; the portraits test enforces it), and flavour text in the style of the existing ones.
- Decks: 60 cards, ≤ 4 copies per name (basic Energy aside), ≤ 1 ACE SPEC; Medium-piloted win rate against the premade
  decks (Easy-piloted) 40–65%, tuned in the round-robin.

### Rewards

- No reward for individual Elite matches (as in Kanto).
- **Johto Champion:** first win `1500 credits + 3 me02 packs`; later wins `400 credits + 1 me02 pack`. The Hall of
  Fame entry is added each time. `championReward(first, region)` returns the right `Payout` (with `set: 'me02'` for
  Johto).

### Red (3b)

- **Unlock:** `johtoChampion(g)`. Red is an optional single match, fought with the active deck like a gym (not a run).
- Red plays one deck built around his Pokémon Gold/Silver-era team from the 151 set (Charizard ex, Snorlax, Lapras,
  Pikachu and friends), coherent in two colours, Hard bot. He gets an original portrait and flavour text.
- `GymProgress.redBeaten: boolean` (default false). First win: `2000 credits + 3 me02 packs` and `redBeaten = true`;
  later wins pay normal bot credits. Context `{ kind: 'red', deck }`; `describe`, `GymGameOver` and `awards` handle it.

### Screens

- **Johto tab** below the badge case: an **Elite Four** panel (locked until 8 badges: "Earn all 8 badges to enter
  (n / 8)"; then "Start Elite Four" / "Continue run", the five names in order with the current one highlighted, as in
  Kanto), a Johto **Hall of Fame** panel, and (3b) a **Red** panel ("Mt. Silver": locked until the Johto Champion,
  then Challenge / Rematch).
- **Match setup** reuses the Kanto Elite setup: pick one deck for the whole run (active-deck panel, locked once the run
  starts), then Battle! per match; game over shows Next / Replay / Gym Challenge as in Kanto.
- Phone: panels stack, no sideways scroll at 390 px. Collector mode closes Gym Challenge as before.

### Bots and registration (CLAUDE.md)

- Every new deck goes into `GYM_DECKS`, the bots' gym-fuzz count and round-robin targets, and the economy
  `gym-decks` count (19 → 23 after part 2; +5 for 3a, +1 for 3b). Gym decks stay out of `DECKS`.

## Code shape

- `apps/web/src/game/gym.ts`: `JOHTO_ELITE`, `eliteOf(region)`, `championStage(region)`, `kantoChampion`,
  `johtoChampion`, region-aware `canStartElite`/`startRun`/`applyEliteResult`/`championReward`, `normalizeGym`
  (run region, entry region, `redBeaten`); (3b) `RED`, `applyRedResult`, `redUnlocked`.
- `apps/web/src/profile/useProfile.ts`, `game/gymMatch.ts`, `game/describe.ts`, `game/store.ts` (context),
  `game/awards.ts`, `ui/GymGameOver.tsx`, `game/town.ts`: region plumbing as above.
- `apps/web/src/screens/GymChallenge.tsx`: the Elite Four and Hall of Fame panels become region-aware and appear on
  both tabs; (3b) the Red panel.
- `apps/web/src/game/portraits.ts`: five (3a) + one (3b) looks.
- `packages/cards`: `decks/gym/{will,johto-koga,johto-bruno,karen,johto-lance}.json` (+ `red.json`), scripts, tests;
  `packages/bots` and `packages/economy`: counts and targets.

## Tests

- Pure: region-aware Elite helpers (start needs 8 badges of that region, one run at a time, per-region champion stage,
  region defaults for old saves), `kantoChampion` vs `johtoChampion`, `johtoUnlocked` ignoring Johto entries, rewards,
  `applyEliteResult` for the Johto Champion (entry with `region: 'johto'`, 1500/3 first then 400/1), `normalizeGym`.
- Profile: `startEliteRun` with a Johto deck, `beginEliteMatch`, abandon-on-reload loses the run, `recordElite` pays
  the Johto Champion and a `me02` pack, a Kanto run is unaffected; (3b) Red's first win and rematch.
- Screens: the Johto Elite panel locked/unlocked, the run flow to Lance, the other region's panel blocked while a run
  is open, the Johto Hall of Fame, (3b) Red locked/unlocked.
- Cards/bots: `assertGymDeck`, one test per new script, gym-fuzz with Easy and Hard pilots, round-robin win rates in
  the PR.
- E2E at 390 and 1400 px: with 8 Johto badges the Johto Elite panel is ready and "Start Elite Four" begins Will's match.

## Not in this part

- Frontier integration for Johto opponents, counter-picking for Lance, engine hooks for cards the engine cannot run,
  new town buildings.
