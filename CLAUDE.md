# Project notes

- **New decks must also be available to the bots.** Whenever a deck is added to the game (starter, theme, Gym or any other),
  also add it to the list of decks the bot opponent can use. Bots pick a random deck from `DECKS` in
  `apps/web/src/game/catalog.ts` (starter and theme decks, never custom ones), so a new deck goes there. Also add it to the
  balance and fuzz decks in `packages/bots` (`scripts/round-robin.ts`, `test/fuzz.test.ts`, `test/gym-fuzz.test.ts`).
