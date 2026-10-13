# Active deck and Deck Case — design

Date: 2026-10-13 · Status: decisions made in chat, awaiting written-spec review · Step 2 of 5 in the decks + Johto
roadmap · Depends on: `2026-10-13-deck-ownership-design.md` (shipped)

## Goal

Choosing a deck stops being a long list of tiles on every setup screen. The player always has one **active deck**.
Duel and Gym start with it, and a **Change** button opens the **Deck Case**: a full screen of the player's decks as
boxes, with a filter and a card-list preview. The first-launch intro previews a starter's cards before the player
commits.

## Success criteria

- A player always has a playable active deck: a saved choice that is no longer usable (a deleted or now-invalid
  custom deck) quietly falls back, and the Deck Case shows which deck is active.
- Duel and Gym setup show the active deck (cover, name, type) and a Change button instead of the deck tiles.
  Starting a match uses the active deck.
- The Deck Case lists every owned premade deck and every custom deck. A custom deck that can't be played is shown
  with its reason, not hidden. Choosing a deck there makes it the active deck.
- The Deck Builder also lists the player's premade decks, which can be viewed and copied into a new custom deck.
- In the intro, tapping a starter shows its card list and a Choose button.
- Everything fits a 390-px-wide phone with no sideways scroll.

## Rules

### The active deck

- The save gains `activeDeck: string | null`: an owned premade deck id, or `custom:<id>` for a custom deck. `null`
  means "not chosen yet".
- `resolveActiveDeck(profile, usableCustom)` returns the deck a match would use: the saved `activeDeck` if it is an
  owned premade deck or a usable custom deck, otherwise the saved `starterDeck` if owned, otherwise the first owned
  premade deck. A save with none of those (an unfinished intro) has no active deck.
- **Existing saves:** `activeDeck` starts as `null`, so players keep using their starter, exactly as today.
- **First intro:** the chosen starter becomes both `starterDeck` and `activeDeck`. Replaying the intro leaves the
  active deck alone (it still only changes `starterDeck`, and only to an owned deck, as in step 1).
- `setActiveDeck(id)` saves the choice. It ignores an id that is not an owned premade deck or an existing custom deck.
- **Usable** for Duel means Standard-legal and valid for the player's collection (`validateCustomDeck`). For Gym it
  also allows the 151 set (`validateGymDeck`). A custom deck that is usable only in Gym can be made active; in Duel
  the setup then says "This deck can only be used in Gym Challenge" and Play is disabled until the player changes it.

### Duel and Gym setup

- The "Your deck" tiles are replaced by an **active deck panel**: cover, name, energy type, and a **Change** button.
- **Change** opens the Deck Case. Choosing a deck there sets it active and returns to the screen the player came
  from. The Deck Case's Back button returns there too without changing anything.
- **Hotseat:** player 1 uses the active deck. Player 2 keeps today's tile picker, now the only place it appears, over
  every premade deck and the player's valid custom decks.
- **Bots** still pick a random premade deck from all of them.
- **Gym:** a single gym match uses the active deck. An Elite Four run keeps the copy of the deck it locked at the
  start, as today.
- **Battle Frontier** is unchanged.

### The Deck Case

- A new screen (`deckcase` route) reached from Change in Duel and Gym, from My House and from the Deck Builder.
  Collector mode closes it like the other battle screens.
- **Boxes:** one for each owned premade deck, then one for each custom deck. A box shows the cover, name, energy
  type, a format badge on custom decks (Standard or Gym only), and an **ACTIVE** badge on the active deck.
- **A custom deck that can't be played** (for example 52 of 60 cards, or a card that isn't owned any more) shows
  dimmed with the first problem written out, e.g. "Not a legal deck: 52 / 60 cards". It can be opened and edited
  from the Deck Builder but not made active.
- **Filter:** All, then one chip for each energy type that appears in the player's decks, plus Premade and Custom.
- **Preview:** choosing a box shows its full card list (Pokémon, Trainers, Energy, with counts) and a **Use this
  deck** button. The active deck's button reads "Active deck" and is disabled.
- **Phone:** boxes sit in a two-column grid. The preview opens as a bottom sheet instead of beside the grid.
- **Empty case:** with no custom decks the Custom chip is hidden, and a note says "Build your own decks in the Deck
  Builder."

### The Deck Builder

- Its list gains a **Premade decks** section above the custom decks: the owned premade decks, each with **View** (the
  card list) and **Copy to edit**, which creates a custom deck named "<deck> copy" from that list and opens the
  editor. Because buying a deck adds its cards to the collection, the copy is valid straight away.
- The note "Starter decks are always available on the Home screen." is replaced by a short pointer to the Deck Case
  and the Poké Mart.
- The Deck Builder gets a **Deck Case** button.

### My House (Trainer Card)

- The Trainer Card shows the active deck (today it shows the default starter) and gains a **Deck Case** button next
  to the existing ones (hidden in Collector mode).

### The intro

- Tapping a starter tile opens a sheet with its card list and a **Choose this deck** button. Choosing continues to
  the tips as today. Skip is unchanged.

## Code shape

- `apps/web/src/game/deckCase.ts` (pure): `resolveActiveDeck`, `deckProblem(custom, registry, collection)` (the
  first reason a custom deck can't be played, or null), `caseEntries(profile)` (the boxes, with badge and problem),
  `filterEntries(entries, filter)`.
- `apps/web/src/profile/types.ts` and `useProfile.ts`: `activeDeck`, `setActiveDeck`, `finishIntro` sets it on the
  first intro.
- `apps/web/src/nav/useNav.ts`: a `deckcase` route, plus an optional `returnTo` so Change comes back to Duel or Gym;
  `App.tsx` closes `deckcase` in Collector mode.
- `apps/web/src/screens/DeckCase.tsx` and `apps/web/src/ui/deckcase/*` (box, filter, preview).
- `apps/web/src/ui/ActiveDeckPanel.tsx`: the panel and Change button used by Duel and Gym setup.
- Edit `DuelSetup.tsx`, `GymChallenge.tsx` (single gyms), `DeckBuilder.tsx`, `TrainerCard.tsx`, `Intro.tsx`.
  `DeckChoice.tsx` stays for hotseat player 2 only.
- Reuse `Sheet`, `RunDeckView` (card list) and `FormatBadge`.

## Tests

- Pure: `resolveActiveDeck` for each fallback (saved choice, deleted custom deck, unowned premade, starter, first
  owned, none); `deckProblem` reasons; `filterEntries`.
- Profile: `setActiveDeck` saves and ignores unknown or unowned ids; the first intro sets it; replaying doesn't.
- Screens: Duel and Gym show the active deck and Change; Change → Deck Case → Use this deck returns with the new
  deck and starting uses it; Back changes nothing; an unusable custom deck is shown with its reason and can't be
  made active; a Gym-only active deck disables Play in Duel with the notice; hotseat player 2 still has the tile
  picker; the Deck Builder lists premade decks, Copy to edit opens a valid editor, and the Deck Case route is closed
  in Collector mode; the Trainer Card shows the active deck; the intro preview shows 60 cards and Choose continues.
- Existing Duel and Gym tests that pick a deck by tapping a tile now set `activeDeck` instead.
- E2E: at 390 and 1400 px, open the Deck Case from Duel, filter, preview, use a bought deck, and start a Duel with it,
  with no sideways scroll.

## Not in this step

- Johto (steps 3–5), editing premade decks in place, search or sorting in the Deck Case, deck names/notes, and
  sharing decks.
