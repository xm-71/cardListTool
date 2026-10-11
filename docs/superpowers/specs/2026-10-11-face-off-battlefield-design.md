# Face-off battlefield, battle animations and ticker

Date: 2026-10-11. Status: approved (owner picked Option A "Face-off" plus Option B's ticker from the
mockups at https://claude.ai/artifact/VAMAiJ4GSSgAsGiTytzJfN).

## 1. Why

On phones the battlefield is hard to follow: the opponent shrinks to a thumbnail and HP chips, the hand
hides behind a button, every move goes through a sheet, and attacks, damage and Knock Outs happen
instantly, so the opponent's turn goes by unseen.

## 2. Decisions (from the owner)

| Question | Answer |
| --- | --- |
| Layout | Face-off on phone widths (`useIsPhone`, < 1024 px). Desktop keeps its layout. |
| Animations and ticker | Everywhere (phone and desktop). |
| Playing a card | Tap a hand card, then tap a glowing spot. Cards with no target get a Play button. Choices still use the prompt panel. |
| Speed | Options setting: Normal / Fast / Off. Reduced-motion devices start on Off. Skip button during the opponent's turn. |
| Delivery | This spec, then 3 PRs, each merged and deployed when CI is green. |

## 3. Phase 1: Face-off layout (phones)

A new `FaceOffBoard` replaces `OpponentStrip`, the phone `Side`, the hand sheet and the `ActionBar`
when `useIsPhone()` is true. Hotseat (with `PassDevice`) uses it too. Top to bottom, one screen, no
scrolling (360–430 px wide, 640 px tall and up):

1. **Top bar**: opponent name and hand count, their Prize pips, and a Menu button (Show log,
   Concede, Quit to home: the current `ActionBar` menu sheet).
2. **Opponent Bench**: one row of 5 spaces (small cards, about 13 vw, max 56 px), each with an
   HP bar underneath. Empty spaces are faint dashed outlines.
3. **Opponent Active**: large (about 29 vw, max 120 px) with its HP bar and Special Conditions.
4. **Middle line**: turn chip ("Turn 3 · Your turn") and the Stadium, if any.
5. **Your Active**: larger (about 33 vw, max 140 px). Your Prize pips sit to its left, deck and
   discard counts to its right (discard opens `DiscardViewer`).
6. **Your Bench**: same row as the opponent's.
7. **Hand**: always visible, fanned along the bottom and overlapping when crowded. Playable cards are
   ringed. A tapped card lifts up. End turn is a fixed button at the bottom right, above the fan.

Energy shows as small `EnergyDot` pips along the card's bottom edge instead of Energy cards over
the art. Tools stay as the existing label.

**Interaction**

- Tap a hand card: it lifts and every legal target glows. Targets come from a new pure helper
  `targetsFor(legal, uid): { ref: SlotRef | 'bench-space'; action: Action }[]` (evolve,
  attachEnergy and targeted playTrainer give slots; playBasic gives the next empty Bench space).
  Tapping a glowing spot dispatches its action. When one spot has two actions, a small popover
  lists them with `describeAction`.
- A card with untargeted actions (playTrainer without a target, and playBasic as an alternative to
  the Bench space) shows a **Play** button above the lifted card.
- Tap your Active, or a Benched Pokémon with actions: an action popover beside it lists its
  attacks (cost dots, damage; greyed when unusable), Ability, Retreat and Card details. At the
  start of your turn your Active pulses when it can attack.
- Tap an opponent card, or long-press any card: card zoom / `CardDetails`, as today.
- Prompts keep using `PromptPanel`.

**Tests**: unit tests for `targetsFor`; component tests (tap card then target dispatches the action;
Play button for untargeted Trainers; attack popover dispatches the attack; opponent card opens
details); phone e2e (crowded board fits 390 × 844 with no sideways scroll, opponent Active at least
100 px wide, hand cards visible without tapping, End turn inside the viewport).

## 4. Phase 2: Battle animations (all widths)

**Engine events** (additive fields on existing log events, no rule changes): `attack` gets `slot`;
`damage` gets `target` and `amount`; `knockout` gets `ref`; `prize` gets `count`; `promote`,
`retreat`, `playBasic`, `attachEnergy` (`uid`, `target`), `evolve` (`uid`, `target`), `playTrainer`
(`uid`), condition and `checkup` events get the slot they affect; `coinFlip` gets `heads`.

**Director** (`game/animation/`): the store keeps `state` (the truth). The board draws `shown`.
When `state` moves on, a pure `beatsFor(events, before, after, viewer)` turns the new events into
beats; the director plays them against the DOM (elements tagged with `data-anim` keys such as
`slot:1:active`, `slot:0:bench:2`, `hand:<uid>`, `deck:0`, `prizes:1`, `handcount:1`), then sets
`shown = state`. The board ignores taps while beats play; prompts appear after. The bot driver
waits for the director to be idle before its next move, so the opponent's turn plays one move at
a time. Animations use the Web Animations API on ghost copies in a fixed overlay layer.

| Beat | Animation | Normal |
| --- | --- | --- |
| Attack | attacker lunges toward the defender, hit flash and shake | 0.5 s |
| Damage | number floats up, HP bar drains green → yellow → red | 0.8 s |
| Knock Out | card flashes white, greys and drops away | 0.9 s |
| Prize | card back flies from the prize pips to the hand | 0.5 s |
| Card play / promote / retreat | card flies to its spot | 0.45 s |
| Draw | card back flies from the deck to the hand (or hand count) | 0.4 s |
| Energy | Energy flies onto the Pokémon, ring pulse, pip pops in | 0.6 s |
| Evolve | white flash, card swaps with a bounce | 0.9 s |
| Turn start | banner sweeps across ("Your turn" / "<Name>'s turn") | 1.1 s |
| Coin flip | coin spins and lands on H or T | 1.2 s |
| Condition / checkup | bubbles (Poison), flame (Burn), Zz (Asleep), damage float | 0.8 s |

Fast multiplies durations by 0.4; Off plays no beats. Setting: `animations: 'normal' | 'fast' |
'off'` in `useSettings` (default `off` when `prefers-reduced-motion`, else `normal`), radio group in
Options.

**Tests**: `beatsFor` unit tests per event type; director tests with fake timers (beats in order,
`shown` updates at the end, Off is instant, bot waits); settings tests; e2e: an attack shows a
damage number and the board ends in the engine's state.

## 5. Phase 3: Ticker

A one-line ticker reads out the current beat in plain words from the viewer's side: "Brock's Onix
used Rock Throw", "Your Gastly took 30 damage", "You took a Prize card". Opponent names come from
the game config (Gym Leader name, "Rival" in Duel, "Player 2" in hotseat). A pure
`describeEvent(e, viewer, names)` also replaces "Player 1/2" in `GameLog`.

- Phone: the ticker sits under the top bar, with a **Log** button that opens the full log.
- Desktop: the ticker sits above the board; the log stays in the side column.
- During the opponent's turn a **Skip** button finishes that turn's remaining beats at 5× speed.
- The ticker is `aria-live="polite"`.

**Tests**: `describeEvent` unit tests; ticker shows each beat's text; Skip speeds up the remaining
beats; Log opens the history.

## 6. Out of scope

Desktop layout changes, drag and drop, new sound effects, particle art beyond the beats above.
