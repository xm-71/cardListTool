# Hard bot — design

Date: 2026-10-11 · Status: approved in chat, awaiting written-spec review

## Goal

A third bot difficulty, **Hard**, that is clearly stronger than Medium and still feels quick on a phone.
Hard is offered in the Duel picker now, and is reserved for the late fights of the roguelike run (designed
separately). The Gym and Elite Four keep their current difficulties.

## Success criteria

- Hard beats Medium in **at least 60%** of bot-vs-bot games across all starter, theme and meta decks
  (both seats, round-robin script).
- Hard's **95th-percentile think time is 2 seconds or less** per decision on a desktop Node run, and it thinks about
  1.5 seconds per decision on any device because its budget is measured by the clock.
- Easy and Medium play exactly as they do today (same choices for the same inputs).
- Fuzz games with Hard finish with no invariant violations.

## Why Medium is beatable

Medium tries each candidate move on a few guessed versions of the hidden cards (`determinize`), finishes **its own
turn** with the Easy policy, and scores the board with `evaluate`. It never looks at the opponent's reply, so it
happily makes moves that leave its Active Pokémon open to a Knock Out or let the opponent set up a big attack.

## Design

### `createHardBot` (`packages/bots/src/hard.ts`)

```ts
interface HardOptions {
  /** Thinking budget per decision, by the clock. Default 1500 ms. */
  budgetMs?: number;
  /** Always run at least this many rounds of guesses, even past the budget. Default 1. */
  minRounds?: number;
  /** Never run more than this many rounds. Default 16. */
  maxRounds?: number;
  /** Clock in ms. Default `performance.now`. Tests, fuzz runs and balance runs pass a fake one. */
  now?: () => number;
}
createHardBot(registry, decks: [DeckList, DeckList], seat, options?: HardOptions): Bot
```

The `Bot` signature is unchanged, so the worker, `runMatch` and the fuzz tests use it like the other bots.

**Scoring a candidate move in one guessed world:**

1. Apply the move.
2. Finish Hard's own turn (and any prompts it causes) with the Easy policy, as Medium's `rollout` does.
3. **New:** if the game is not over and it is now the opponent's turn, play the opponent's whole turn (and the
   prompts it causes for either player) with the Easy policy, up to a step cap.
4. Score with the evaluator from Hard's side.

A move that throws in a guessed world scores `-1e9` for that world, as in Medium.

**Rounds:** one round = one fresh `determinize` guess and every candidate scored once in it. Rounds repeat until the
budget is spent (checked between rounds) or `maxRounds` is reached, with at least `minRounds`. Because a round
always finishes, every candidate has the same number of samples when thinking stops. Best total wins; ties are
broken by the RNG (same `pickBest` as Medium).

**Promotions** (the "Choose a new Active Pokémon" prompt) are scored the same way: promote on each guessed world,
then play the opponent's reply, then evaluate. **Other prompts** are answered by the Easy policy, as in Medium,
because a paused effect can't be rebuilt from a view. Anything that throws falls back to Easy, as in Medium.

**Shared code:** `rollout`, `pickBest` and `dedupe` move out of `medium.ts` into a small shared module
(`search.ts`) that both bots import, with no change in behavior for Medium.

### Scoring

`evaluate` stays as it is. If the Hard-vs-Medium games show a clear, repeatable weakness (for example decking out),
a fix goes into an evaluator used **only by Hard**, so Easy and Medium are unchanged.

### App (`apps/web`)

- Difficulty type becomes `'easy' | 'medium' | 'hard'` in `botClient.ts`, `store.ts` and `gym.ts` (the
  Gym data keeps its current values).
- `botFor` builds `createHardBot(registry, decks, seat)` for `'hard'` (real clock in the app and the worker).
- `DuelSetup` adds **"Hard bot"** after "Medium bot".

### Balance script (`packages/bots/scripts/round-robin.ts`)

Add a mode that plays Hard against Medium on every deck pair, both seats, with a fixed number of rounds instead of
the clock so results are reproducible. It reports Hard's win rate, plus each decision's think time with the real clock
(median and 95th percentile) from a smaller timed sample.

## Testing

- `packages/bots/test/hard.test.ts`:
  - In a hand-built position where one move leaves Hard's Active open to a Knock Out next turn and another doesn't,
    Hard picks the safe move. The same position shows Medium picking the unsafe one, which proves the test needs the
    reply lookahead.
  - With a fake clock that passes the budget after the first round, Hard stops after `minRounds`. With a frozen
    clock it stops at `maxRounds`.
  - Same inputs and options give the same choice.
  - It always returns one of the legal actions, including for prompts.
- Fuzz: `fuzz.test.ts` and `gym-fuzz.test.ts` add Hard (fixed `maxRounds: 1`, frozen clock) against the other bots
  across the decks, with zero invariant violations.
- Web: the Duel picker test covers the "Hard bot" option, and `botFor` builds a Hard bot for `'hard'`.
- Measured, not in CI: the balance script's Hard-vs-Medium run meets both success criteria; numbers go in the PR.

## Out of scope

- Using Hard in the Gym or Elite Four.
- Smarter answers to effect prompts (card searches, discards).
- The roguelike run, which gets its own spec.

## Delivery

One PR on `claude/kind-meitner-2p99da`: green CI, merge, then check the Vercel production deploy.
