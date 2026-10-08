# Theme Decks (Phase 1 of "more decks") — Design Spec

Date: 2026-10-08
Status: Draft for review

## 1. Goal

Add six new pre-built **theme decks**, one per Mega ex, so every deck type the game offers has a ready-made deck to play with or against.

The owner asked for all four kinds of new decks, in this order:

1. **theme decks** (this spec);
2. more official Mega-era starter decks;
3. current meta decks (M6);
4. Classic rules plus the 1999 theme decks.

Each later phase gets its own spec.

### The six decks (picked by the owner)

| Deck                | Type      | Mega line                                     | Mega stage |
| ------------------- | --------- | --------------------------------------------- | ---------- |
| Mega Charizard X ex | Fire      | Charmander → Charmeleon → Mega Charizard X ex | Stage 2    |
| Mega Venusaur ex    | Grass     | Bulbasaur → Ivysaur → Mega Venusaur ex        | Stage 2    |
| Mega Abomasnow ex   | Water     | Snover → Mega Abomasnow ex                    | Stage 1    |
| Mega Manectric ex   | Lightning | Electrike → Mega Manectric ex                 | Stage 1    |
| Mega Kangaskhan ex  | Colorless | Mega Kangaskhan ex                            | Basic      |
| Mega Lopunny ex     | Colorless | Buneary → Mega Lopunny ex                     | Stage 1    |

## 2. Rules for the decks

- **Legality:** every card is Standard-legal (regulation mark H or later; Basic Energy has no mark).
- **Real cards only:** every card comes from Mega Evolution (`me01`) or Phantasmal Flames (`me02`), plus Trainers the game already supports.
- **Fan-made lists:** these are not official products. The picker labels them "Theme deck" to tell them apart from the official "Starter deck" lists.
- **Format:** 60 cards, at most 4 copies of a name, at least one Basic Pokémon, at most 1 ACE SPEC. The decks pass `validateCustomDeck`'s format rules; the "owned cards" rule doesn't apply to built-in decks.
- **Availability:** like starter decks, theme decks are always available. They don't need owning, and they work for you, for the bot opponent and in hotseat.
- **Fully playable:** every card in every list must pass `isPlayable`. A test checks this, the same way the starter decks are checked.

### Shared Trainer core

25 cards, used by every deck unless noted:

| Card                   | Count |
| ---------------------- | ----- |
| Lillie's Determination | 4     |
| Iris's Fighting Spirit | 2     |
| Boss's Orders          | 2     |
| Ultra Ball             | 4     |
| Buddy-Buddy Poffin     | 3     |
| Mega Signal            | 2     |
| Switch                 | 2     |
| Night Stretcher        | 2     |
| Wally's Compassion     | 2     |
| Air Balloon            | 2     |

Adjustments:

- **Stage 2 decks** (Charizard, Venusaur) swap the 2 Air Balloon for 3 Rare Candy.

Counts get tuned when a deck is finished (see §4). No new Trainer scripts are needed.

## 3. Draft decklists

Pokémon are listed with the new card scripts each deck needs. Energy brings each list to 60.

### 3.1 Mega Charizard X ex (Fire)

- **Pokémon:**
  - Charmander ×4 (Agile: no Retreat Cost without Energy)
  - Charmeleon ×2
  - Mega Charizard X ex ×3 (Inferno X: discard any number of {R} Energy from your Pokémon; 90 damage per card)
  - Oricorio ex ×2 (Excited Turbo: attach {R} from hand to a Benched {R} Pokémon)
  - Moltres ×2 (+90 against Pokémon ex)
  - Volcanion ×1 (Singe Burns; Backfire puts 2 {R} Energy into your hand)
  - Chi-Yu ×1 (discards a Stadium and blocks Stadiums next turn)
- **Energy:** Fire ×19 (15 Pokémon + 26 Trainers + 19 Energy)

### 3.2 Mega Venusaur ex (Grass)

- **Pokémon:**
  - Bulbasaur ×4 (Bind Down: the Defending Pokémon can't retreat)
  - Ivysaur ×3
  - Mega Venusaur ex ×3 (Solar Transfer: move Basic {G} Energy freely; Jungle Dump heals 30)
  - Exeggcute ×2 (attach a {G} Energy from your deck)
  - Exeggutor ×2 (Guard Press −30; +30 per {G} Energy)
  - Shuckle ×2 (heal 30 once a turn)
  - Celebi ×1 (search {G} Pokémon or Stadiums)
- **Energy:** Grass ×17 (17 + 26 + 17)

### 3.3 Mega Abomasnow ex (Water)

- **Pokémon:**
  - Snover ×4
  - Mega Abomasnow ex ×3 (Hammer-lanche: mill 6, 100 per Basic {W} milled; Frost Barrier −30)
  - Suicune ×2 (+90 with 4+ {W} in play)
  - Kyogre ×2 (Riptide counts {W} in discard and shuffles them back; Swirling Waves discards 2)
  - Mantine ×2 (Call for Family)
  - Eiscue ×1 (coin flip: Paralyzed)
- **Energy:** Water ×21 (14 + 25 + 21). Hammer-lanche needs Energy in the deck.

### 3.4 Mega Manectric ex (Lightning)

- **Pokémon:**
  - Electrike ×4 (10 damage to itself)
  - Mega Manectric ex ×3 (Flash Ray blocks damage from Basic Pokémon; Riotous Blasting optionally discards all Energy for +130)
  - Raikou ×2 (+90 with 4+ {L} in play)
  - Yamper ×2 → Boltund ×2 (coin-flip boosts)
  - Magnemite ×2 → Magneton ×1 (coin flip: Paralyzed)
- **Energy:** Lightning ×19 (16 + 25 + 19)

### 3.5 Mega Kangaskhan ex (Colorless)

- **Pokémon:**
  - Mega Kangaskhan ex ×4 (Run Errand: draw 2 while Active, one Run Errand per turn; Rapid-Fire Combo flips until tails, +50 per heads)
  - Miltank ×2 (coin flips to heal all; Tackle)
  - Stufful ×2 → Bewear ×2 (Hyper Lariat coin flips)
  - Zigzagoon ×2 → Linoone ×2 (Excited Dash: swap into the Active Spot while you have a Mega ex)
  - Meowth ×1 (Fury Swipes)
- **Energy:** 20 Basic Energy (15 + 25 + 20). These attacks are all Colorless, so any type works; the list uses a Lightning/Fighting mix.

### 3.6 Mega Lopunny ex (Colorless)

- **Pokémon:**
  - Buneary ×4 (Charm: −20 to the Defending Pokémon's attacks)
  - Mega Lopunny ex ×3 (Gale Thrust +170 if it moved from Bench to Active this turn; Spiky Hopper ignores effects on the Defending Pokémon)
  - Lopunny ×1 (Dashing Kick: 50 to a Benched Pokémon)
  - Zigzagoon ×2 → Linoone ×2 (Excited Dash enables Gale Thrust)
  - Jigglypuff ×2 → Wigglytuff ×2 (Round: 40 for each of your Pokémon with Round)
- **Energy:** 19 Basic Energy (16 + 25 + 19).

**Total:** about 40 Pokémon names to script. Vanilla cards (no rules text) need no script.

## 4. Engine additions

All are small and covered by tests:

- **`becameActiveTurn` on a slot.** Set when a Pokémon moves from the Bench to the Active Spot: retreat, switch, promotion, or the opponent's gust. Gale Thrust and Linoone combos need it.
- **Option to ignore the Defending Pokémon's effects.** `dealAttackDamage` gets an option to skip the Defending Pokémon's `modifyIncomingDamage` hooks and lingering effects that reduce incoming damage (Spiky Hopper).
- **Lingering "prevent damage from Basic Pokémon".** Uses the existing `GameState.lingering` and the incoming-damage hook (Flash Ray).
- **Stadium lock.** "Your opponent can't play Stadium cards from their hand during their next turn" (Chi-Yu), as a lingering effect checked by Stadium legality.
- **"Run Errand" name limit.** Uses the existing `abilityNamesUsedTurn` to allow one Run Errand per turn across all your Kangaskhan.
- **Optional attack choices.** For example Riotous Blasting's "you may discard all Energy". These use the existing yes/no prompt (`chooseOption`).

## 5. Picker and app

- **Catalog:** `catalog.ts` gains the six decks, each with id, name, type, list and cover card. `DeckId` grows to match.
- **Duel picker:** decks are grouped as "Starter decks" (the 3 official ones), "Theme decks" (the 6 new ones) and "Custom decks". Every group works for both "Your deck" and "Opponent's deck".
- **Intro:** the starter-deck choice in the intro stays the 3 official decks.
- **Bots:** Easy and Medium already take any decklist. The Medium bot gets the real decklist through `BotSetup`, as it does now.

## 6. Testing

- **Per card:** each new script gets a test, following the existing card tests: set up a state, use the card, check the result.
- **Engine additions:** each gets a unit test.
- **Per deck:**
  - the deck totals 60 cards;
  - every card exists in the card data and is playable;
  - the deck passes the format checks in `validateCustomDeck`.
- **Fuzz:** the bot fuzz suite covers all 9 decks (3 starter + 6 theme). Every pairing runs seeded Easy-vs-Easy games, checking the engine's invariants and that every game ends. With 9 decks there are 45 pairings, so each pairing runs fewer games to keep CI time flat.
- **Medium bot:** the Medium-vs-Easy check stays as is.
- **Balance:** after the decks are in, I'll run a short Easy-vs-Easy round-robin and report each deck's win rate. If one deck is far off (below 30% or above 70%), I adjust its counts and say what changed.
- **Browser test:** pick a theme deck in Duel and play a turn.

## 7. Out of scope

- Official starter decks (Phase 2), meta decks (Phase 3) and Classic (Phase 4).
- New Trainer cards.
- Deck art beyond a cover card.
