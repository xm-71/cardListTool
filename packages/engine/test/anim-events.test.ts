import { describe, expect, test } from 'vitest';
import { createEngine } from '../src/engine.ts';
import type { EventAnim, GameEvent, GameState, PlayerId } from '../src/types.ts';
import {
  act,
  attachFromDeck,
  benchFromHand,
  giveCard,
  miniRegistry,
  pokemon,
  started,
  swapActiveTo,
} from './fixtures.ts';

const fighter = pokemon('fighter', { types: ['Fighting'], hp: 100 });
const engine = createEngine(miniRegistry([fighter]));
const deck = { 't-basic': 20, 't-evo': 4, fighter: 2, 't-dark': 24, 't-psy': 10 };

/** Turn 2: the second player acts. */
function turn2(): { s: GameState; me: PlayerId; opp: PlayerId } {
  let s = started(engine, deck, deck, 5);
  s = act(engine, s, { type: 'endTurn' });
  const me = s.current;
  return { s, me, opp: me === 0 ? 1 : 0 };
}
/** The animation info of the events an action added. */
const anims = (before: GameState, after: GameState): EventAnim[] =>
  after.log
    .slice(before.log.length)
    .map((e: GameEvent) => e.anim as EventAnim | undefined)
    .filter((a): a is EventAnim => !!a);
const base = (s: GameState, p: PlayerId) => s.players[p].active!.stack[0]!;

describe('log events say what to animate', () => {
  test('attaching Energy names the card and the Pokémon (by its first card)', () => {
    const { s, me } = turn2();
    const dark = giveCard(s, me, 't-dark');
    const target = { player: me, zone: 'active' } as const;
    const next = act(engine, s, { type: 'attachEnergy', uid: dark, target });
    expect(anims(s, next)).toContainEqual({ kind: 'energy', uid: dark, target: base(s, me) });
  });

  test('playing a Basic puts it on the Bench', () => {
    const { s, me } = turn2();
    const uid = giveCard(s, me, 't-basic');
    const next = act(engine, s, { type: 'playBasic', uid });
    expect(anims(s, next)).toContainEqual({ kind: 'bench', uid, player: me });
  });

  test('evolving names the evolution and the Pokémon it goes on', () => {
    let { s } = turn2();
    s = act(engine, act(engine, s, { type: 'endTurn' }), { type: 'endTurn' });
    const me = s.current;
    swapActiveTo(s, me, 't-basic');
    s.players[me].active!.enteredTurn = 0;
    const evo = giveCard(s, me, 't-evo');
    const next = act(engine, s, { type: 'evolve', uid: evo, target: { player: me, zone: 'active' } });
    expect(anims(s, next)).toContainEqual({ kind: 'evolve', uid: evo, target: base(s, me) });
  });

  test('an attack names its attacker, then damage, Knock Out, Prizes and the promoted Pokémon', () => {
    const { s, me, opp } = turn2();
    swapActiveTo(s, me, 'fighter');
    swapActiveTo(s, opp, 't-basic');
    attachFromDeck(s, me, 't-dark');
    s.players[opp].active!.damage = 50;
    const benched = giveCard(s, opp, 't-basic');
    benchFromHand(s, opp, benched);
    const attacker = base(s, me);
    const defender = base(s, opp);
    let next = act(engine, s, { type: 'attack', attackIndex: 0 });
    if (next.prompt) next = act(engine, next, { type: 'answer', optionId: next.prompt.options[0]!.id });
    const kinds = anims(s, next);
    expect(kinds[0]).toEqual({ kind: 'attack', by: attacker });
    expect(kinds).toContainEqual({ kind: 'damage', target: defender, amount: expect.any(Number) });
    expect(kinds).toContainEqual({ kind: 'knockout', target: defender });
    expect(kinds).toContainEqual({ kind: 'prize', player: me, count: 1 });
    expect(kinds).toContainEqual({ kind: 'promote', target: benched, player: opp });
  });

  test('retreating names who goes to the Bench and who comes in', () => {
    const { s, me } = turn2();
    attachFromDeck(s, me, 't-dark');
    attachFromDeck(s, me, 't-dark');
    const incoming = giveCard(s, me, 't-basic');
    benchFromHand(s, me, incoming);
    const out = base(s, me);
    let next = act(engine, s, { type: 'retreat', benchIndex: 0 });
    while (next.prompt)
      next = act(engine, next, {
        type: 'answer',
        optionId: next.prompt.selected.length >= next.prompt.min ? 'done' : next.prompt.options[0]!.id,
      });
    expect(anims(s, next)).toContainEqual({ kind: 'retreat', from: out, to: incoming, player: me });
  });

  test('Poison between turns is damage on the Poisoned Pokémon', () => {
    const { s, me } = turn2();
    s.players[me].active!.conditions.poisoned = true;
    const next = act(engine, s, { type: 'endTurn' });
    expect(anims(s, next)).toContainEqual({
      kind: 'checkup',
      target: base(s, me),
      condition: 'poisoned',
      amount: 10,
    });
  });
});
