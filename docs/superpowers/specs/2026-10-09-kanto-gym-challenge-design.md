# Kanto Gym Challenge — Design Spec

Date: 2026-10-09
Status: Draft for review

## 1. Goal

Add a **Gym Challenge**: the player battles the 8 Kanto Gym Leaders in order, earning a badge for each win. With all 8 badges, the player takes on the Elite Four and the Champion in one run.

The leaders play modern, type-themed decks built around their famous Pokémon. Those Pokémon come from the **Scarlet & Violet 151** set (`sv03.5`), which this project imports.

### What the owner chose

- **Cards:** modern, type-themed leader decks.
  - The leaders' signature Pokémon come from the **151** set; the current Mega-era sets lack most of them (no Starmie, Machamp, Weezing or Dragonite).
- **Progression:** Game Boy style.
  - 8 gyms in a fixed order, Brock first.
  - 8 badges unlock the Elite Four.
  - The Elite Four and Champion are fought back to back with one deck; a single loss restarts the run from Lorelei.
- **Difficulty:** it ramps up from the Easy bot to the Medium bot.
- **Rewards:**
  - each first badge pays credits and a 151 pack;
  - the first Champion win pays a large bonus and adds a Hall of Fame entry.
- **151 for players:** a 151 pack goes in the Shop and is also given as a gym reward. Its cards can be used in the player's Gym Challenge decks; Duel stays Standard-only.

### Research notes

- **The 151 set:**
  - `sv03.5`, released 2023-09-22, 207 cards. TCGdex has data and images for every card.
  - Its regulation mark is G, so it is **not Standard-legal in 2026** (Expanded only). This is why Gym Challenge needs its own deck format (§4).
  - Besides every original Pokémon, it has leader-themed Trainers: **Erika's Invitation** and **Giovanni's Charisma**.
- **Pokémon ex:** 151's "Pokémon ex" are the regular ex (2 Prizes), not Mega Evolution ex.

## 2. The challenge

### 2.1 Gyms (fixed order)

| #   | Leader    | Badge   | Deck type           | Bot    | Signature Pokémon (151 unless noted)                                                                   |
| --- | --------- | ------- | ------------------- | ------ | ------------------------------------------------------------------------------------------------------ |
| 1   | Brock     | Boulder | Fighting            | Easy   | Geodude → Graveler → Golem ex, Onix, Rhyhorn → Rhydon                                                  |
| 2   | Misty     | Cascade | Water               | Easy   | Staryu → Starmie, Krabby → Kingler, Tentacool → Tentacruel                                             |
| 3   | Lt. Surge | Thunder | Lightning           | Easy   | Pikachu → Raichu, Voltorb → Electrode, Magnemite → Magneton                                            |
| 4   | Erika     | Rainbow | Grass               | Easy   | Oddish → Gloom → Vileplume, Exeggcute → Exeggutor, Tangela, Erika's Invitation                         |
| 5   | Koga      | Soul    | Darkness            | Medium | Koffing → Weezing, Grimer → Muk, Ekans → Arbok ex                                                      |
| 6   | Sabrina   | Marsh   | Psychic             | Medium | Abra → Kadabra → Alakazam ex, Mr. Mime, Slowpoke → Slowbro                                             |
| 7   | Blaine    | Volcano | Fire                | Medium | Growlithe → Arcanine, Ponyta → Rapidash, Vulpix → Ninetales ex                                         |
| 8   | Giovanni  | Earth   | Darkness + Fighting | Medium | Nidoran♂ → Nidorino → Nidoking, Nidoran♀ → Nidorina → Nidoqueen, Rhyhorn → Rhydon, Giovanni's Charisma |

### 2.2 Elite Four and Champion (one run, all Medium bot)

| Stage | Opponent      | Deck type                          | Signature Pokémon                                                |
| ----- | ------------- | ---------------------------------- | ---------------------------------------------------------------- |
| 1     | Lorelei       | Water                              | Seel → Dewgong, Shellder → Cloyster, Lapras, Jynx ex, Articuno   |
| 2     | Bruno         | Fighting                           | Machop → Machoke → Machamp, Hitmonlee, Hitmonchan, Onix          |
| 3     | Agatha        | Psychic + Darkness                 | Gastly → Haunter → Gengar, Zubat → Golbat, Mega Gengar ex (me02) |
| 4     | Lance         | Water + Lightning (Dragon Pokémon) | Dratini → Dragonair → Dragonite, Magikarp → Gyarados             |
| 5     | Champion Blue | Psychic + an ace type              | Abra → Kadabra → Alakazam ex, plus one ace line (below)          |

- **Blue's ace:** decided at the start of the Champion match from the main Energy type of the challenger's deck:
  - Fire: Blastoise ex line;
  - Grass: Charizard ex line;
  - Water: Venusaur ex line;
  - any other type: Charizard ex line.

  So there are 3 Champion lists, which differ only in the ace line (Charmander → Charmeleon → Charizard ex, Squirtle → Wartortle → Blastoise ex, or Bulbasaur → Ivysaur → Venusaur ex).

- **Changes from the first draft:** the first draft also listed Kabuto/Kabutops (Brock), Aerodactyl (Lance), Pidgeot (Blue), Seaking, Seadra and Psyduck (Misty), Victreebel (Erika), Kangaskhan ex (Giovanni) and more. The Pokémon that evolve from Fossils, or that prevent effects, change coin-flip rules or deal end-of-turn damage, need rules the engine lacks, so they are left out for now. The rest were trimmed to keep each deck coherent. Each deck is 60 cards: those Pokémon, the leader's Energy and a Trainer core, with the exact lists in the implementation plan.
- **Dimensional Hand** (Alakazam ex): "can be used even if this Pokémon is on the Bench" is implemented as a normal attack from the Active Spot.

### 2.3 Rules of the run

- **Gyms:**
  - only the next unbeaten gym can be challenged;
  - beaten gyms can be re-challenged at any time;
  - losing a gym match costs nothing.
- **Starting the Elite Four** needs all 8 badges.
  - The player picks one Gym-format deck (§4), which is locked for the whole run.
  - Matches are fought in order, each a fresh game.
- **Losing** any Elite Four or Champion match ends the run. The next attempt starts from Lorelei, and the player can pick a different deck.
- **Saving:** the run is saved after every win, so the player can quit and come back mid-run. Quitting mid-match counts as a loss, like conceding in Duel.
- **Winning** the Champion match completes the run and adds a Hall of Fame entry. A new run can be started any time after that.
- **Coin flip:** who goes first is decided as in Duel.

## 3. Rewards

- **First badge from each gym:**
  - credits: 100 for Brock, plus 25 for each later gym (Giovanni: 275);
  - one free 151 pack, opened right away with the usual pack animation.
- **Gym rematches:** the normal bot-win credits, as in Duel.
- **Elite Four match wins:** no reward; the run is the reward.
- **First Champion win:** 1,000 credits and 3 free 151 packs.
- **Later Champion wins:** 300 credits and 1 pack.
- **Hall of Fame:** every Champion win adds an entry with the player name, date, deck name and deck cover. Entries are shown newest first.
- **Collector mode:** Gym Challenge is a battling mode, so Collector mode hides it like Duel and Decks.

## 4. Gym deck format

- **"Standard"** (today's rules) stays the format for Duel.
- **"Gym"** applies to Gym Challenge decks:
  - the same deck rules: 60 cards, at most 4 copies of a name, at least 1 Basic, at most 1 ACE SPEC;
  - every card must be playable (`isPlayable`);
  - a card is allowed if it is Standard-legal **or** comes from set `sv03.5`.
- **Deck builder:** each custom deck gets a format label. "Standard" means it is legal in Duel and Gym Challenge; "Gym" means 151 cards make it Gym Challenge only.
  - The Duel picker shows only Standard decks.
  - The Gym Challenge picker shows both: starter, theme and custom decks.
- **Ownership:** Gym Challenge uses the same ownership rules as Duel. Custom decks need owned cards; starter and theme decks are always available.

## 5. Cards and packs

- **Import:** add `sv03.5` to the card importer and data. Card images follow the existing TCGdex URL pattern.
- **Scripts:** write card scripts **only for the 151 cards used in the leader decks**: their attacks, Abilities, and the Trainers Erika's Invitation and Giovanni's Charisma.
  - Other 151 cards are collect-only until scripted, like any unscripted card.
  - Expected count: about 80 card names (the exact list is the set of cards in the 15 decklists).
- **151 pack:** a Shop pack, priced like the Mega-era packs, in a new "Scarlet & Violet" era section.
  - It uses the same 10-card pack layout as the Mega-era packs, with 151's rarities: Common, Uncommon, Rare, Double Rare, Illustration Rare, Special Illustration Rare, Ultra Rare, Hyper Rare.
  - Any rarity name the pack generator or the rarity effects don't yet know is added and covered by tests.
- **Binder:** the binder lists the 151 set under its era, with the "Playable" badge on scripted cards.
- **Engine:** no new engine rules are expected. If a needed card does need one, it is added with a unit test, as with the theme decks.

## 6. Balance

- **Win rates:** a round-robin script plays each leader deck against the 3 starter decks and the 6 theme decks, Easy vs Easy. Target win rates:
  - Brock, Misty, Surge, Erika: 30–50%;
  - Koga, Sabrina, Blaine, Giovanni: 40–60%;
  - Elite Four and Champion: 45–65%.
- **Adjusting:** a leader outside its range has its counts adjusted, and the change is reported.
- **Mixing:** the bot difficulty in §2 is part of the ramp, so a leader on the Medium bot needs no stronger list than one on Easy.

## 7. Architecture

### Cards and data (`packages/cards`, `packages/economy`)

- **Cards:** the `sv03.5` data, the new scripts, and `src/decks/gym/<leader>.json` (13 lists, counting the 3 Champion variants).
- **Format:** `isGymLegal(def)` and `validateGymDeck(deck, registry, collection)` in economy, alongside the Standard checks.
- **Shop:** the 151 entry in `PACKS`.

### Web app (`apps/web`)

- **Data:** `src/game/gym.ts` holds the static data: leaders in order, badge names, deck ids, bot level, rewards, and intro, win and lose lines.
- **Menu:** a "Gym Challenge" item, hidden in Collector mode.
- **Screen `GymChallenge`:**
  - a badge case of 8 tiles, each showing the leader, type, badge (earned or locked) and a Challenge or Rematch button;
  - an Elite Four panel with the run's state (locked, ready, or in progress at stage N) and a Hall of Fame list.
- **Match flow:**
  1. The leader's intro line shows in the `DialogBox`.
  2. The player picks a Gym-format deck; in a run, the run's deck is already locked in.
  3. The game starts against the leader's deck and bot.
  4. The result screen shows the win or lose line and any reward, and returns to Gym Challenge.
- **Game context:** a game started here carries `{ kind: 'gym', leaderId }` or `{ kind: 'elite', stage }`, so finishing it updates challenge progress instead of (or as well as) the normal Duel award. It is awarded once per game seed, like Duel.

### Profile (all writes through the queued `change()`)

- `gym.badges: string[]`: earned badge ids, in the order earned.
- `gym.run: { stage: 0 | 1 | 2 | 3 | 4; deck: DeckRef } | null`: the current Elite Four run.
- `gym.hallOfFame: { date: string; deckName: string; cover: string; playerName: string }[]`.
- **Migration:** older profiles load with no badges, no run and an empty Hall of Fame.

## 8. Delivery

There are two plans, each with its own PR:

1. **Part 1, cards:**
   - the 151 import and pack;
   - the Gym format;
   - the card scripts;
   - the 13 leader decklists;
   - fuzz coverage and the balance round-robin.

   Nothing changes for players except the new pack.

2. **Part 2, the mode:**
   - the Gym Challenge screen and progression;
   - the Elite Four run;
   - rewards and the Hall of Fame;
   - dialogue;
   - profile migration;
   - browser tests.

## 9. Testing

- **Per card:** a test for each new script, as with the theme decks.
- **Per leader deck:**
  - it totals 60 cards;
  - every card exists and is playable;
  - it passes `validateGymDeck`.
- **Format:**
  - a deck with a 151 card is Gym-legal but not Standard-legal;
  - the Duel picker hides it, and the Gym Challenge picker offers it.
- **Fuzz:** seeded Easy-vs-Easy games across every leader deck against the starter and theme decks: no invariant violations, and every game ends.
- **Progression** (unit tests on pure functions):
  - gyms unlock only in order;
  - a first badge pays its reward exactly once, even if the same game result arrives twice;
  - 8 badges unlock the Elite Four;
  - an Elite Four loss resets the run to stage 0;
  - a Champion win clears the run and adds a Hall of Fame entry;
  - Blue's ace follows the challenger's main Energy type.
- **Component tests:**
  - the badge case shows locks and badges correctly;
  - the Elite Four panel shows the run stage;
  - the Hall of Fame lists entries newest first;
  - Gym Challenge is hidden in Collector mode.
- **Playwright:**
  - start Brock's gym with a starter deck, play a turn, and check the screen at desktop and phone widths;
  - load a profile with all 8 badges and check the Elite Four panel.

## 10. Out of scope

- Other regions (Johto and later): this spec builds Kanto only.
- Classic-era leader decks using the real "Brock's Onix" cards from Gym Heroes/Challenge (needs the Classic rules phase).
- Scripting every 151 card; only the cards the leaders need are scripted.
- A world map, overworld or trainer battles before gyms.
- Leader portraits beyond a type icon and the leader's signature Pokémon card art.
