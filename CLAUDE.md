# Project notes

- **New decks must also be available to the bots.** Whenever a deck is added to the game (starter, theme, Gym or any other),
  also add it to the list of decks the bot opponent can use (the bot deck pool in `apps/web/src/screens/DuelSetup.tsx` /
  `apps/web/src/game/`), and to the balance and fuzz decks in `packages/bots` (`scripts/round-robin.ts`, `test/fuzz.test.ts`).
