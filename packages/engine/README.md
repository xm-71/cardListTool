# @ptcg/engine

Pure Pokémon TCG rules engine (2026–27 Standard rules). No DOM, no network, no
`Math.random`: every game is reproducible from its seed and action list.

## API

```ts
import { createEngine } from '@ptcg/engine';
import { buildRegistry, megaGengarDeck, megaDiancieDeck } from '@ptcg/cards';

const engine = createEngine(buildRegistry()); // optional 2nd arg: a Ruleset (default standard2026)
let state = engine.createGame({ decks: [megaGengarDeck, megaDiancieDeck], seed: 42 });
const player = state.prompt ? state.prompt.player : state.current;
const legal = engine.getLegalActions(state, player); // every legal move, including prompt answers
state = engine.applyAction(state, player, legal[0]).state; // throws IllegalActionError otherwise
const view = engine.viewFor(state, player); // what that player may see
```

- `GameState` is plain JSON. `applyAction` never mutates its input.
- `viewFor` hides the opponent's hand, both decks, prize identities, the RNG and paused-effect data.
- `checkInvariants(state, registry)` lists structural problems (each player owns exactly 60 cards
  across zones, no card in two places, no negative damage, Bench ≤ 5).

## Choices inside effects (prompts and replay)

Card effects are scripts that act through an `EffectCtx`. When a script needs a decision
(`ctx.chooseCards`, `ctx.chooseSlot`, `ctx.chooseOption`), the engine pauses:

- The returned state shows everything that has happened so far, plus `state.prompt`.
- The only legal actions are `{ type: 'answer', optionId }`, one option at a time.
  `'done'` finishes a multi-select once its minimum is met.
- `state.pending` records the pre-action snapshot, the originating action and the answers so far.
  Answering _replays_ the action from the snapshot with the recorded answers. The RNG is part of
  the snapshot, so coin flips and shuffles come out the same on replay.

This keeps state serializable (no closures), which the online server (M5) and bots rely on.

## Card scripts

`CardScript` (see `src/cards.ts`) offers:

- attack `damage` / `effect` / `canUse`, activated `abilities`, `trainer.play` / `canPlay`,
  and `stadium.use` / `onBenchFromHand`;
- passive hooks: `modifyOutgoingDamage` (before Weakness/Resistance), `modifyIncomingDamage`
  (after), `modifyRetreatCost`, `modifyPrizes`, `afterDamagedInActive` (Tools), and
  `onEvolveFromHand`.

## Known simplifications

- The winner of the opening coin flip always goes first.
- The opponent's extra draws for mulligans are taken automatically (all of them).
- If both players win at the same moment, the game is a draw (no sudden death).
- Prize cards are taken from the top of the prize pile.
- Each activated Ability can be used once per turn per Pokémon.
