import { describe, expect, test } from 'vitest';
import { GYM_DECKS } from '../src/gym.ts';
import { act, assertGymDeck, attachFromDeck, engine, game, resolvePrompts, swapActiveTo } from './helpers.ts';

const POLIWAG = 'sv03.5-060';
const POLIWHIRL = 'sv03.5-061';
const POLIWRATH = 'sv03.5-062';
const MANKEY = 'sv08-098';
const PRIMEAPE = 'sv08-099';
const ANNIHILAPE = 'sv08-100';
const FIGHTING = 'mee-006';
const WATER = 'mee-003';
const spec = {
  [POLIWAG]: 4,
  [POLIWHIRL]: 4,
  [POLIWRATH]: 4,
  [MANKEY]: 4,
  [PRIMEAPE]: 4,
  [ANNIHILAPE]: 4,
  [FIGHTING]: 20,
  [WATER]: 20,
};
type S = ReturnType<typeof game>['s'];
const attack = (s: S, i: number) => act(engine, s, { type: 'attack', attackIndex: i });
const tank = (s: S, opp: 0 | 1) => {
  swapActiveTo(s, opp, MANKEY);
  s.players[opp].active!.damage = -500;
};
const dealt = (s: S, opp: 0 | 1) => s.players[opp].active!.damage + 500;
/** Runs `attack` with several seeds and returns the set of outcomes `read` produced. */
function outcomes<T>(
  prepare: (s: S, me: 0 | 1, opp: 0 | 1) => void,
  i: number,
  read: (s: S, me: 0 | 1, opp: 0 | 1) => T,
) {
  const seen = new Set<T>();
  for (let seed = 1; seed < 60; seed++) {
    const { s: s0, me, opp } = game(spec, spec, { seed });
    prepare(s0, me, opp);
    seen.add(read(resolvePrompts(attack(s0, i)), me, opp));
  }
  return seen;
}

describe('Chuck deck', () => {
  test('60 playable, Gym-legal cards within the deck rules', () => assertGymDeck(GYM_DECKS.chuck));
});

describe('Poliwag', () => {
  test('Bubble does 10 and Paralyzes on heads only', () => {
    const seen = outcomes(
      (s, me, opp) => {
        swapActiveTo(s, me, POLIWAG);
        tank(s, opp);
        attachFromDeck(s, me, WATER);
      },
      0,
      (s, _me, opp) => `${dealt(s, opp)}:${s.players[opp].active!.conditions.rotation}`,
    );
    expect(seen).toEqual(new Set(['10:paralyzed', '10:none']));
  });
});

describe('Poliwhirl', () => {
  test('Frog Hop does 30, or 90 on heads', () => {
    const seen = outcomes(
      (s, me, opp) => {
        swapActiveTo(s, me, POLIWHIRL);
        tank(s, opp);
        attachFromDeck(s, me, WATER);
        attachFromDeck(s, me, WATER);
      },
      1,
      (s, _me, opp) => dealt(s, opp),
    );
    expect(seen).toEqual(new Set([30, 90]));
  });
});

describe('Poliwrath', () => {
  test('Bubble Beam does 50 and Paralyzes on heads', () => {
    const seen = outcomes(
      (s, me, opp) => {
        swapActiveTo(s, me, POLIWRATH);
        tank(s, opp);
        attachFromDeck(s, me, WATER);
      },
      0,
      (s, _me, opp) => `${dealt(s, opp)}:${s.players[opp].active!.conditions.rotation}`,
    );
    expect(seen).toEqual(new Set(['50:paralyzed', '50:none']));
  });

  test('Heroic Punch does 100, or 250 on heads', () => {
    const seen = outcomes(
      (s, me, opp) => {
        swapActiveTo(s, me, POLIWRATH);
        tank(s, opp);
        for (let i = 0; i < 3; i++) attachFromDeck(s, me, WATER);
      },
      1,
      (s, _me, opp) => dealt(s, opp),
    );
    expect(seen).toEqual(new Set([100, 250]));
  });
});

describe('Mankey and Primeape', () => {
  test('Dual Chop does 10 damage for each of 2 heads', () => {
    const seen = outcomes(
      (s, me, opp) => {
        swapActiveTo(s, me, MANKEY);
        tank(s, opp);
        attachFromDeck(s, me, FIGHTING);
      },
      0,
      (s, _me, opp) => dealt(s, opp),
    );
    expect(seen).toEqual(new Set([0, 10, 20]));
  });

  test('Sweep the Leg does 30 and may discard an Energy from the Defending Pokémon', () => {
    const seen = outcomes(
      (s, me, opp) => {
        swapActiveTo(s, me, PRIMEAPE);
        tank(s, opp);
        attachFromDeck(s, me, FIGHTING);
        attachFromDeck(s, opp, FIGHTING);
      },
      0,
      (s, _me, opp) => `${dealt(s, opp)}:${s.players[opp].active!.energy.length}`,
    );
    expect(seen).toEqual(new Set(['30:0', '30:1']));
  });
});

describe('Annihilape', () => {
  test('Tantrum does 130 and Confuses Annihilape', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, ANNIHILAPE);
    tank(s0, opp);
    attachFromDeck(s0, me, FIGHTING);
    const s = attack(s0, 0);
    expect(dealt(s, opp)).toBe(130);
    expect(s.players[me].active!.conditions.rotation).toBe('confused');
  });

  test('Destined Fight Knocks Out both Active Pokémon', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, ANNIHILAPE);
    swapActiveTo(s0, opp, MANKEY);
    attachFromDeck(s0, me, FIGHTING);
    attachFromDeck(s0, me, FIGHTING);
    const mine = s0.players[me].active!.stack[0]!;
    const theirs = s0.players[opp].active!.stack[0]!;
    const s = resolvePrompts(attack(s0, 1));
    const gone = (player: 0 | 1, uid: string) =>
      s.players[player].active?.stack[0] !== uid && !s.players[player].bench.some((b) => b.stack[0] === uid);
    expect(gone(me, mine)).toBe(true);
    expect(gone(opp, theirs)).toBe(true);
  });
});
