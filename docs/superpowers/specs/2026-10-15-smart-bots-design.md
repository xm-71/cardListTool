# Smart bots (Gym Challenge difficulty, part A) — design

Date: 2026-10-15 · Status: written, awaiting spec review

## Where this fits

The player beats every Gym Leader and the Elite Four in a few turns. Research (2026-10-15) found two causes: the bots
play badly (every bot answers card choices with the first option and plays out turns with Easy's random order), and the
gym decks are thin. The work is split into three sub-projects, each with its own spec, plan and PRs:

- **A. Smart bots** (this spec): Medium and Hard play like a sensible player.
- **B. V / VMAX / VSTAR** in the engine, so Sword & Shield decks can be used.
- **C. Meta decks for every leader** by type (Scarlet & Violet, Mega Evolution and Sword & Shield), with the Gym card
  rule (H mark or later, or the 151 set) lifted for all leaders, and the difficulty ramp: early gyms fair, late gyms,
  Elite Four and Champions at meta level.

Baseline measured on 2026-10-15 (each gym deck with its in-game bot vs the 6 meta decks and 3 Mega decks piloted by
today's Hard bot, 18 games each): Kanto gyms 1–4 win 6–28%; Medium-piloted leaders 22–72%; Hard-piloted Johto gyms,
Johto Elite Four and Red 28–67%.

## Goal

Medium and Hard bots answer card choices sensibly, play Trainers in a sensible order, retreat, see scripted damage and
plan Prizes, so every Medium/Hard opponent (Gym, Elite Four, Champion, Red, Duel, Battle Frontier) plays clearly
better, within today's thinking budget. Easy stays exactly as it is.

## Success criteria

- New Hard beats today's Hard in at least 60% of games over every ordered pair of the 15 premade decks.
- Rerunning the 2026-10-15 gym probe, the Medium- and Hard-piloted leaders' win rates rise clearly over the baseline
  (reported before/after per leader). Final judgement is the player's playtest.
- The existing timing check holds: 95% of Hard decisions take at most 2 s (budget stays 1.5 s).
- The existing fuzz runs pass for every premade and gym deck: no invariant violations, no stalled games.
- No engine or app changes; Easy's behaviour is byte-for-byte unchanged (its tests stay as they are).

## Rules

### The smart policy

A new rule-based policy, `createSmartBot(registry, deck)` in `packages/bots/src/smart.ts`, with the same `Bot` shape as
Easy. Medium and Hard use it in two places: to answer every prompt other than promotion (which they already search),
and as the policy that plays out the rest of a turn inside their look-ahead (`rolloutTurn`). It is not offered as a
difficulty on its own.

**Card choices.** A prompt is classified from what the view shows, not from its message text where avoidable:

| Kind | Recognised by | Choice |
| --- | --- | --- |
| Opponent's Pokémon | slot options on the opponent's side | Highest Prize value that the bot can Knock Out this turn; else the most damaged relative to HP; ties to the highest retreat cost when it will be stuck Active |
| Damage counters on the opponent | as above, repeated prompts | Finish a Knock Out first, else stack on the highest Prize value |
| Own Pokémon — switch in / promote | own Benched slots, switching | The Pokémon that can attack now for the most damage (Knock Out first); else the one closest to attacking |
| Own Pokémon — attach / move to | own slots, Energy or Tool | The planned attacker closest to paying its best attack |
| Own Pokémon — heal | own slots, message mentions heal | Most damage × Prize value |
| Cards to take (deck, discard) | card options not in the bot's hand | Highest-priority card from the deck plan that the board is missing (see Deck plan); up to the prompt's max |
| Cards to discard (hand) | card options in the bot's hand | Least useful first: Energy beyond what the board needs, extra copies, Basics with no Bench room or plan role; never the last copy of a main attacker or Rare Candy while a Stage 2 line waits for it |
| Yes/no, numbers, attack choice | `option` prompts | As Easy does today, except "use which attack": the one that Knocks Out, else the most estimated damage |

**Turn order.** Each step picks among the legal actions of that kind; the turn ends when nothing useful is left:

1. Search Items and Basics that fill the plan (Nest Ball, Poffin, Ultra Ball, Arven), and Basics to the Bench up to
   what the plan needs (not Benching extra ex or Mega Pokémon the plan does not need).
2. Evolutions and Rare Candy.
3. Draw Supporters only if the hand has no next useful play (or the hand is 3 cards or fewer); Iono / Research are
   never played into a hand that still has plays.
4. Boss's Orders / gust effects only when the bot can then Knock Out the pulled Pokémon and it is worth more Prizes
   than Knocking Out the current Active, or the Active cannot be damaged usefully.
5. Abilities (once a turn for repeatable ones, as Easy), Tools, Stadiums.
6. Energy to the Active if it then can attack, else to the planned next attacker.
7. Retreat when the Active cannot attack this turn and a Benched Pokémon can (or the Active is about to be Knocked Out
   and is worth more Prizes than the replacement), paying with Energy the plan needs least.
8. Attack: one that Knocks Out, else the most estimated damage; then end the turn.

### Deck plan

`deckPlan(deck, registry)` in `packages/bots/src/plan.ts`, built once per bot from its own deck list:

- **Main attackers**: Pokémon whose best attack has the highest estimated damage per Energy, top 1–2 lines.
- **Evolution lines**: for each final stage, its Basic and middle stage (by `evolvesFrom`).
- **Support Pokémon**: Pokémon with draw or search Abilities (scripted Abilities whose card text draws or searches).
- **Search priority**: next missing evolution piece of a main line, then a main attacker's Basic, then support
  Pokémon, then Energy the attackers need, then a draw Supporter when the hand is thin.

Overrides: `DECK_PLANS` in `packages/bots/src/plans.ts`, keyed by deck name, may set the main attackers or put a
support line first (e.g. "Pidgeot first"). Only decks that need it get an entry; none is required.

### Scoring (Medium and Hard)

`evaluate` changes, Easy is unaffected:

- **Estimated damage**: each attack's damage is worked out once by playing it in a small sandbox game (that Pokémon
  Active with the given attached Energy against a plain target), cached per card, attack and Energy count; printed
  damage is the fallback when the sandbox cannot run it. Used for "can I Knock Out their Active" and "can they Knock
  Out mine next turn".
- **Prize map**: the number of Knock Outs each side still needs, using the Prize value of the Pokémon on the board
  (1, 2 for ex, 3 for Mega). Fewer is better. Benched ex/Mega Pokémon beyond the plan's needs are a penalty (gust
  targets). Benched Knock Outs count their full Prize value.
- **Setup**: next attacker on the Bench with Energy, and its evolution piece in hand, score higher; hand cards count by
  usefulness to the plan, not by count.

Hard keeps its structure (its own turn plus the opponent's reply, 1.5 s budget, `maxRounds`); the look-ahead uses the
smart policy instead of Easy.

### Who is affected

Every Medium and Hard opponent: Kanto gyms 5–8, both Elite Fours, Blue, Lance, Red, the Johto gyms, Duel-mode Medium
and Hard, and Battle Frontier opponents on those levels. Leader difficulty assignments do not change here (the ramp
comes with part C). The app keeps calling `createMediumBot` / `createHardBot` with the same arguments.

## Code shape

- `packages/bots/src/smart.ts` — the smart policy (prompts, turn order, retreat).
- `packages/bots/src/plan.ts` — `deckPlan`; `plans.ts` — `DECK_PLANS` overrides.
- `packages/bots/src/damage.ts` — sandbox damage estimate with its cache.
- `packages/bots/src/evaluate.ts` — prize map, setup terms, estimated damage (Easy does not use it).
- `packages/bots/src/medium.ts`, `hard.ts`, `search.ts` — use the smart policy for prompts and rollouts.
- `packages/bots/scripts/round-robin.ts` — a `--smart` mode: new Hard vs today's Hard on every ordered pair, where
  "today's Hard" is the Hard bot built with the Easy rollout and today's scoring, kept selectable by an option for
  this comparison only.

## Tests

- `test/smart.test.ts`, on small built positions: Boss's Orders takes the ex it can Knock Out over a Basic it cannot;
  Ultra Ball takes the missing Stage 1 over a fourth Basic; the discard keeps Rare Candy while a Stage 2 is pending;
  Switch brings in the Pokémon that can attack; retreats when the Active cannot attack and a Benched one can; no Iono
  into a hand with plays; Energy goes to the planned attacker; no extra ex Benched.
- `test/plan.test.ts`: plans for current decks name sensible attackers and lines (Johto Lance: Dragonite and Charizard
  ex lines; Dragapult: the Dreepy line; Crustle: Dwebble line), and an override changes the order.
- `test/damage.test.ts`: a scaling attack (more damage per Energy) is estimated above its printed damage; the cache
  returns the same value; an attack the sandbox cannot run falls back to printed damage.
- Existing: `easy.test.ts` unchanged and green; `fuzz.test.ts` and `gym-fuzz.test.ts` green with the new bots;
  `hard.test.ts` timing check green.
- Strength scripts (not CI): `round-robin.ts --smart` and the gym probe, results in the PR description.

## Not in this part

Engine changes, new decks, changing which leader uses which difficulty, a smarter Easy, longer think time, search over
prompt answers (rebuilding a paused effect inside a guessed game), and learning or tuning from played games.
