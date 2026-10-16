# Meta decks for the top of the Gym Challenge (Scarlet & Violet and Mega Evolution) — design

Date: 2026-10-16 · Status: written, awaiting spec review · Depends on: smart bots (part A, merged in #43)

## Where this fits

The player beats every Gym Leader and the Elite Four in a few turns. Part A made Medium and Hard play sensibly. This
part gives the top of the challenge real meta decks. It is the first of three specs:

1. **This spec:** meta decks built from Scarlet & Violet and Mega Evolution cards, no engine changes.
2. V / VMAX / VSTAR support in the engine (card stages, Prize values, VSTAR Power), importing Sword & Shield sets.
3. Sword & Shield meta decks (Lugia, Arceus, Palkia, Mew VMAX, Regidrago, …), after spec 2.

## Goal

The 13 decks at the top of the challenge (both Elite Fours, the Champions and Red) become type-matched meta decks from
the 2023–2026 tournament scene, so the late game plays like a real tournament opponent. Kanto gyms 1–8 and the Johto
gyms keep their themed decks: the difficulty steps up at the Elite Four.

## Success criteria

- The 13 decks below are replaced; each is 60 cards, every card playable, at most 4 of a name, at most 1 ACE SPEC.
- Every set a new deck draws a card from is imported whole and sold in the shop as packs, like the Mega Evolution sets.
- Measured with the probe below, each tier lands in its starting band; the player's playtest is the final judge.
- Every replaced deck passes the existing fuzz games (no invariant violations, no stalls) with its in-game bot.
- No engine changes. Kanto gyms 1–8, the Johto gyms, the player's own deck rules and Easy bots are unchanged.

## Rules

### Who plays what

| Leader (deck id) | Type | Deck |
| --- | --- | --- |
| Lorelei (`lorelei`) | Water | Chien-Pao ex / Baxcalibur |
| Bruno (`bruno`) | Fighting | Mega Lucario ex (Hariyama, Solrock) |
| Agatha (`agatha`) | Psychic | Gardevoir ex / Munkidori |
| Lance, Kanto Elite Four (`lance`) | Dragon | Dragapult ex |
| Blue, Fire (`blue-fire`) | Fire | Charizard ex / Pidgeot ex |
| Blue, Water (`blue-water`) | Water | Mega Greninja ex or Mega Starmie ex, whichever verifies; else a second Chien-Pao build |
| Blue, Grass (`blue-grass`) | Grass | Teal Mask Ogerpon ex / Meganium |
| Will (`will`) | Psychic | Lillie's Clefairy ex |
| Koga, Johto (`johto-koga`) | Poison/Darkness | Roaring Moon ex / Pecharunt ex |
| Bruno, Johto (`johto-bruno`) | Fighting | Klawf / Terapagos ex |
| Karen (`karen`) | Darkness | Mega Absol ex Box |
| Lance, Johto Champion (`johto-lance`) | Dragon | Raging Bolt ex / Teal Mask Ogerpon ex |
| Red (`red`) | Lightning | Miraidon ex / Iron Hands ex |

- Each deck starts from a researched tournament list (Worlds, International and Regional results 2023–2026). Every
  card is looked up by name and number in TCGdex; a card that cannot be verified, or that the engine cannot run, is
  swapped for the archetype's standard alternative, and the swap is noted in the PR. Decks need not be exact copies.
- Deck ids stay the same (no save or progression changes). Deck names change to say what they are (e.g. "Lance's
  Dragapult Deck"), and each leader's `type` label in `gym.ts` is updated to the deck's type.
- Blue keeps choosing the deck that counters the player's starter (`championDeckFor`).
- Leader difficulty assignments stay as they are (Elite Four and Champions Medium in Kanto, Hard in Johto, Red Hard).

### Card pool and legality

- Leader decks may use any card with regulation mark D or later, plus the 151 and Mega Evolution sets (the Sword &
  Shield era onwards). Cards with V / VMAX / VSTAR rules wait for spec 2.
- The player's deck rules (Standard and Gym legality in `packages/economy`) do not change.
- Tests: `assertGymDeck` gains a mode that allows the wider pool, used only for the 13 replaced decks.

### Whole sets

- When a new deck uses any card from a set, the whole set is imported: it is added to `packages/cards/src/sets.json`
  and imported in full, and a pack for it is added to the shop (`PACKS` in `packages/economy`, Scarlet & Violet sets
  use the existing `sv` layout, Mega Evolution sets the `mega` layout).
- Only the cards the leader decks use get scripts in this spec. Other cards in those sets show "isn't playable yet"
  in the deck builder, exactly as unscripted Mega Evolution cards do today. Making every card of these sets playable
  is a backlog item (`docs/backlog.md`).

### Bots

- Each replaced deck is played by its leader's existing bot (smart Medium or Hard). Where the computed deck plan picks
  the wrong attacker or support order, an entry in `packages/bots/src/plans.ts` corrects it (for example "Pidgeot
  first" for Charizard).
- Per `CLAUDE.md`, decks used by bots stay in the fuzz and balance lists; the deck ids are unchanged, so the lists keep
  their entries, and `GYM_TARGETS` in `round-robin.ts` gets the new bands for these 13 decks.

### Measuring

A `--probe` mode is added to `packages/bots/scripts/round-robin.ts` (committed, unlike the part A throwaway): each
leader deck, with its in-game bot, plays the 6 meta decks and 3 Mega decks piloted by the Hard bot, both seats, 18
games per leader, and reports win rate and median game length. Starting bands:

| Tier | Leaders | Win rate |
| --- | --- | --- |
| Kanto Elite Four | Lorelei, Bruno, Agatha, Lance | 55–65% |
| Champions and Johto Elite Four | Blue ×3, Will, Johto Koga, Johto Bruno, Karen | 60–70% |
| Finals | Johto Lance, Red | 65–75% |

A deck outside its band is tuned (list changes, plan overrides) before its PR is opened; if a band cannot be reached
the PR says so with the numbers.

## Delivery

Three PRs, each with its balance numbers, CI green and the player's go-ahead before merge:

1. **Foundation and Kanto Elite Four:** the wider legality mode, `--probe`, the whole-set import of every set these
   four decks need, and Lorelei, Bruno, Agatha, Lance.
2. **Champions and Red:** Blue ×3 and Red, with their sets.
3. **Johto Elite Four:** Will, Johto Koga, Johto Bruno, Karen, Johto Lance, with their sets.

## Risks

- A key card needs an engine feature we do not have: the deck uses a stand-in, flagged when the list is resolved, not
  mid-build.
- Researched card numbers were partly unverified: some lists will change on lookup.
- Whole-set imports grow `cards.json` (4.8 MB today) by roughly 2–3 MB; check the web build size and load time.
- Bot-vs-bot numbers can flatter a deck; the bands are a starting point and the playtest decides.

## Tests

- `assertGymDeck` wide mode on each replaced deck; existing tests for the old decks of those leaders are replaced.
- A script test for every newly scripted card (the existing pattern in `packages/cards/test`).
- Fuzz: `gym-fuzz.test.ts` and `fuzz.test.ts` green with the new decks.
- Economy: new packs open and only yield cards of their set and listed rarities (existing pack tests extended).
- `--probe` results per PR in the PR description.

## Not in this part

V / VMAX / VSTAR, Sword & Shield decks, changing the themed gyms, making every card of the imported sets playable,
changing which leader uses which bot, changing rewards or progression.
