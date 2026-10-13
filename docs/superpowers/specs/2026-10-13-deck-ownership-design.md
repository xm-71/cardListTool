# Owning and buying premade decks — design

Date: 2026-10-13 · Status: decisions made in chat, awaiting written-spec review · Step 1 of 5 in the
decks + Johto roadmap (step 2 is the active deck and Deck Case; steps 3–5 are Johto).

## Goal

Premade decks stop being free for everyone. A player owns their starter, buys other premade decks in the Poké Mart,
and gets each bought deck's cards in their collection. Duel and the Gym only offer decks the player owns, plus their
playable custom decks.

## Success criteria

- A new player owns exactly the starter they picked in the intro (Mega Gengar if they skipped), and its 60 cards are
  in their collection.
- An existing save keeps working after the update: the player owns their saved starter and receives its 60 cards once,
  never twice.
- Buying a deck takes its price in credits, adds the deck to the owned list and adds its 60 cards to the collection,
  in one save. It can't be bought twice, or with too few credits.
- Duel and Gym deck choices list only owned premade decks and valid custom decks.
- Bots keep using every premade deck, owned or not.
- An Elite Four run already in progress keeps its locked deck, owned or not.

## Rules

### What a player owns

- The save gains `ownedDecks: string[]`: the ids of premade decks the player owns, in the order they got them.
- **Intro:** finishing the intro sets `ownedDecks` to the chosen starter (Mega Gengar when skipped) and adds its 60
  cards to the collection.
- **Existing saves:** when a save loads with the intro finished and no owned decks (true of every save made before
  this update), `ownedDecks` becomes `[starterDeck]` (Mega Gengar if the starter is missing or unknown) and that deck's
  60 cards are added to the collection. Once a deck is owned the rule no longer applies (decks can't be sold), so the
  cards are granted once. A save whose intro isn't finished gets `ownedDecks: []`; the intro grants the starter.
- Unknown ids in `ownedDecks` (a deck later removed from the game) are dropped when the save loads.

### Prices and the Decks tab

| Deck kind | Decks | Price |
|---|---|---|
| Starter (the 2 not picked) | Mega Gengar, Mega Diancie, Mega Lucario | 300 |
| Theme | 6 Mega theme decks | 600 |
| Meta | 6 meta decks | 1,200 |

- Prices live in `@ptcg/economy` (`CREDITS.deckPrices: { starter: 300, theme: 600, meta: 1200 }` and a
  `deckPrice(kind)` helper).
- The Poké Mart gets two tabs: **Packs** (today's screen, unchanged) and **Decks**.
- The Decks tab lists every premade deck in three groups: Starter, Theme, Meta. Each deck shows its cover card, name,
  energy type, price, or **OWNED** once bought.
- Choosing a deck opens a sheet with its full card list (Pokémon, Trainers, Energy, with counts) and a **Buy for N
  credits** button. The button is disabled with "Not enough credits" when the player can't afford it, and absent when
  the deck is owned.
- After a purchase the sheet says "Added to your decks. 60 cards added to your binder." and the deck shows OWNED.
- Each deck can be bought once. Extra copies of cards come from packs.
- **Collector mode:** the Decks tab is hidden. Battling is closed there, so decks aren't sold.

### Choosing a deck (this step only)

- Duel and Gym deck choices show the owned premade decks, then the player's valid custom decks, using today's tiles.
  Step 2 replaces this picker with the active deck and Deck Case.
- **Hotseat** player 2 chooses from every premade deck, since that side belongs to a friend.
- **Duel bots** pick a random premade deck from all of them, not just the owned ones. Today the bot pool comes from
  the player's list, so this must change.
- **Gym:** single gym matches use an owned deck. An Elite Four run keeps the copy of the deck it locked at the start,
  so a run already going continues even if that deck isn't owned.
- **Battle Frontier** is unchanged: a run lends its starter deck, so it's free and isn't owned afterwards.
- A game that has already started looks its deck up in the full list, so games and retries in progress never break.
- The Trainer Card keeps showing the starter deck until step 2 adds the active deck.

## Code shape

- `packages/economy/src/config.ts`: `deckPrices`; `packages/economy/src/decks.ts` or a new `deckShop.ts`:
  `deckPrice(kind)`.
- `apps/web/src/profile/types.ts`: `ownedDecks` in `Profile` and `newProfile()`; `normalizeProfile` migrates
  (grant once when the field is missing, drop unknown ids).
- `apps/web/src/profile/useProfile.ts`: `buyDeck(id)` (checks ownership, price and credits; adds the deck and its
  cards in one `change`); `finishIntro` grants the starter.
- `apps/web/src/game/catalog.ts`: `ownedDeckSources(owned, custom)` for the player's choices; `deckSources` stays
  the full list for resolving games. `DECKS` stays the bots' pool.
- `apps/web/src/screens/Shop.tsx` + `apps/web/src/ui/shop/DeckShop.tsx`: the tabs and the Decks tab.
- `apps/web/src/screens/DuelSetup.tsx`, `apps/web/src/screens/GymChallenge.tsx`: owned list for the player, full list
  for hotseat player 2 and the bot pool.

## Tests

- Economy: prices per kind.
- Profile: a new intro grants the starter and its cards; migrating an old save grants once (load → save → load
  doesn't grant again); a save mid-intro gets `[]`; unknown ids are dropped; `buyDeck` succeeds, refuses a second
  buy, refuses without enough credits, and refuses in Collector mode.
- Screens: the Decks tab lists 15 decks with prices, OWNED on the starter, the card-list sheet, a purchase that
  updates credits and the collection, and no Decks tab in Collector mode. Duel shows only owned decks while bots still
  get all of them, hotseat player 2 sees every deck, and an Elite run in progress keeps its locked deck.
- E2E: buy a theme deck at phone and desktop widths, with no sideways scrolling, then use it in a Duel.

## Not in this step

- Active deck, Deck Case, deck previews in the intro, and premade decks in the Deck Builder (step 2).
- Adding the Kanto gym decks to `DECKS`. The project rule says every deck goes in the bots' list, but gym decks
  aren't sold and Duel bots don't use them today. This is left as is and noted for the Johto steps, which add gym
  decks.
- Refunds, selling decks, or a gift for existing players.
