import { describe, expect, test } from 'vitest';
import type { GameState, PlayerId } from '@ptcg/engine';
import {
  act,
  answerCards,
  attachFromDeck,
  benchFromHand,
  defIdsOf,
  engine,
  game,
  giveCard,
  resolvePrompts,
  swapActiveTo,
} from './helpers.ts';

const FROAKIE = 'me04-020';
const FROGADIER = 'me04-021';
const GRENINJA = 'me04-022';
const STARYU = 'me03-020';
const STARMIE = 'me03-021';
const CHARMANDER = 'sv03-026'; // 60 HP, weak to Water
const FRIGIBAX = 'sv02-057'; // 60 HP, Water
const WATER = 'mee-003';
const spec = {
  [FROAKIE]: 3,
  [FROGADIER]: 3,
  [GRENINJA]: 3,
  [STARYU]: 2,
  [STARMIE]: 2,
  [CHARMANDER]: 4,
  [FRIGIBAX]: 3,
  [WATER]: 20,
};
const attack = (s: GameState, i = 0) => act(engine, s, { type: 'attack', attackIndex: i });
const attach = (s: GameState, p: PlayerId, n: number) => {
  for (let i = 0; i < n; i++) attachFromDeck(s, p, WATER);
};
const shuriken = (p: PlayerId, zone: 'active' | 'bench' = 'active') =>
  ({
    type: 'useAbility',
    slot: zone === 'active' ? { player: p, zone } : { player: p, zone, index: 0 },
    ability: 'Mortal Shuriken',
  }) as const;
const canShuriken = (s: GameState, p: PlayerId, zone: 'active' | 'bench' = 'active') =>
  engine.getLegalActions(s, p).some((a) => JSON.stringify(a) === JSON.stringify(shuriken(p, zone)));
const emptyHand = (s: GameState, p: PlayerId) => s.players[p].deck.push(...s.players[p].hand.splice(0));
/** Greninja ex Active with `water` Basic {W} Energy in hand and a weak-to-Water Charmander on each side of the table. */
function setup(water: number) {
  const { s, me, opp } = game(spec);
  swapActiveTo(s, me, GRENINJA);
  emptyHand(s, me);
  for (let i = 0; i < water; i++) giveCard(s, me, WATER);
  swapActiveTo(s, opp, CHARMANDER);
  benchFromHand(s, opp, giveCard(s, opp, CHARMANDER));
  return { s, me, opp };
}
/** Pick the target of Mortal Shuriken: 'active' or the first Benched Pokémon of `opp`. */
const pickTarget = (s: GameState, zone: 'active' | 'bench'): GameState => {
  const opt = s.prompt!.options.find((o) => o.slot?.zone === zone)!;
  return act(engine, s, { type: 'answer', optionId: opt.id });
};

describe('Mega Greninja ex', () => {
  test('Mortal Shuriken discards a Basic {W} Energy from the hand and puts 6 damage counters on a Benched Pokémon, ignoring Weakness', () => {
    const { s: s0, me, opp } = setup(2);
    s0.players[opp].bench[0]!.damage = -100; // room to survive; weak to Water, which must not matter
    let s = act(engine, s0, shuriken(me));
    s = resolvePromptsUntilTarget(s, 'bench');
    expect(s.players[opp].bench[0]!.damage).toBe(-100 + 60);
    expect(s.players[me].hand).toHaveLength(1);
    expect(defIdsOf(s, s.players[me].discard).filter((d) => d === WATER)).toHaveLength(1);
  });

  test('Mortal Shuriken on the Active Pokémon is 60 too: counters are not doubled by Weakness', () => {
    const { s: s0, me, opp } = setup(1);
    s0.players[opp].active!.damage = -200; // lots of HP, weak to Water
    let s = act(engine, s0, shuriken(me));
    s = resolvePromptsUntilTarget(s, 'active');
    expect(s.players[opp].active!.damage).toBe(-200 + 60);
  });

  test('Mortal Shuriken Knocks Out a Pokémon with 60 HP or less and takes a Prize card', () => {
    const { s: s0, me, opp } = setup(1);
    const prizes = s0.players[me].prizes.length;
    let s = act(engine, s0, shuriken(me));
    s = resolvePromptsUntilTarget(s, 'bench');
    expect(s.players[opp].bench).toHaveLength(0);
    expect(s.players[me].prizes).toHaveLength(prizes - 1);
  });

  test('Mortal Shuriken needs a Basic {W} Energy in the hand, the Active Spot, and once a turn', () => {
    expect(canShuriken(setup(0).s, 0)).toBe(false);
    const { s: s0, me } = setup(2);
    swapActiveTo(s0, me, FROAKIE);
    benchFromHand(s0, me, giveCard(s0, me, GRENINJA));
    expect(canShuriken(s0, me, 'bench')).toBe(false); // not from the Bench
    const { s: s1, me: me1 } = setup(2);
    const s = resolvePromptsUntilTarget(act(engine, s1, shuriken(me1)), 'bench');
    expect(canShuriken(s, me1)).toBe(false); // a second Energy is in the hand, but it is once a turn
  });

  test('Ninja Spinner does 200 and puts a {W} Energy attached to it into the hand, when taken', () => {
    const { s: s0, me, opp } = setup(0);
    attach(s0, me, 3);
    s0.players[opp].bench.length = 0;
    swapActiveTo(s0, opp, FRIGIBAX); // Water-type: no Weakness to Water
    s0.players[opp].active!.damage = -400;
    let s = attack(s0);
    s = act(engine, s, { type: 'answer', optionId: s.prompt!.options[0]!.id }); // yes
    s = resolvePrompts(s);
    expect(s.players[opp].active!.damage).toBe(-400 + 200);
    expect(s.players[me].active!.energy).toHaveLength(2);
    expect(defIdsOf(s, s.players[me].hand)).toContain(WATER);
  });

  test('Ninja Spinner does 120 and keeps the Energy when declined', () => {
    const { s: s0, me, opp } = setup(0);
    attach(s0, me, 3);
    s0.players[opp].bench.length = 0;
    swapActiveTo(s0, opp, FRIGIBAX); // Water-type: no Weakness to Water
    s0.players[opp].active!.damage = -400;
    let s = attack(s0);
    s = act(engine, s, { type: 'answer', optionId: s.prompt!.options.at(-1)!.id }); // no
    expect(s.players[opp].active!.damage).toBe(-400 + 120);
    expect(s.players[me].active!.energy).toHaveLength(3);
  });
});

/** Answer prompts until the one choosing the Shuriken target, then pick `zone`; then answer the rest with the first option. */
function resolvePromptsUntilTarget(s0: GameState, zone: 'active' | 'bench'): GameState {
  let s = s0;
  for (let guard = 0; s.prompt && guard < 8; guard++) {
    if (s.prompt.options.some((o) => o.slot && o.slot.player !== s.prompt!.player)) {
      s = pickTarget(s, zone);
    } else {
      s = answerCards(s, [WATER]);
    }
  }
  return s;
}

describe('Froakie and Frogadier', () => {
  test('Collect draws a card', () => {
    const { s: s0, me } = game(spec);
    swapActiveTo(s0, me, FROAKIE);
    attach(s0, me, 1);
    const hand = s0.players[me].hand.length;
    const s = attack(s0, 0);
    expect(s.players[me].hand).toHaveLength(hand + 1);
  });

  test('Summoning Jutsu puts up to 3 Pokémon from the deck into the hand', () => {
    const { s: s0, me } = game(spec);
    swapActiveTo(s0, me, FROGADIER);
    attach(s0, me, 1);
    emptyHand(s0, me);
    let s = attack(s0, 0);
    s = answerCards(s, [GRENINJA, GRENINJA, STARMIE]);
    if (s.prompt) s = act(engine, s, { type: 'answer', optionId: 'done' });
    expect(defIdsOf(s, s.players[me].hand).sort()).toEqual([GRENINJA, GRENINJA, STARMIE].sort());
  });
});

describe('Mega Starmie ex', () => {
  test('Jetting Blow does 120 and 50 to a chosen Benched Pokémon without Weakness', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, STARMIE);
    attach(s0, me, 1);
    swapActiveTo(s0, opp, FRIGIBAX);
    s0.players[opp].active!.damage = -400;
    const benched = giveCard(s0, opp, CHARMANDER); // weak to Water: must not matter on the Bench
    benchFromHand(s0, opp, benched);
    const s = attack(s0, 0); // the only Benched Pokémon is chosen without a prompt
    expect(s.players[opp].bench[0]!.damage).toBe(50);
    expect(s.players[opp].active!.damage).toBe(-400 + 120);
  });

  test('Nebula Beam does 210 ignoring Weakness', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, STARMIE);
    attach(s0, me, 3);
    swapActiveTo(s0, opp, CHARMANDER); // weak to Water: a normal 210 would be 420
    s0.players[opp].active!.damage = -400;
    const s = attack(s0, 1);
    expect(s.players[opp].active!.damage).toBe(-400 + 210);
  });
});

