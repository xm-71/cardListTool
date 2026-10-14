import { describe, expect, test } from 'vitest';
import { GYM_DECKS } from '../src/gym.ts';
import { act, assertGymDeck, attachFromDeck, engine, game, resolvePrompts, swapActiveTo } from './helpers.ts';

const SWINUB = 'me02-023';
const PILOSWINE = 'me02-024';
const MAMOSWINE = 'me02-025';
const WATER = 'mee-003';
const STADIUM = 'me01-127';
const spec = { [SWINUB]: 4, [PILOSWINE]: 4, [MAMOSWINE]: 4, [STADIUM]: 2, [WATER]: 30 };
type S = ReturnType<typeof game>['s'];
const attack = (s: S, i: number) => act(engine, s, { type: 'attack', attackIndex: i });
/** A big Defending Pokémon; Swinub is weak to Metal, so Colorless and Water attacks aren't doubled. */
const tank = (s: S, opp: 0 | 1) => {
  swapActiveTo(s, opp, SWINUB);
  s.players[opp].active!.damage = -500;
};
const dealt = (s: S, opp: 0 | 1) => s.players[opp].active!.damage + 500;

describe('Pryce deck', () => {
  test('60 playable, Gym-legal cards within the deck rules', () => assertGymDeck(GYM_DECKS.pryce));
});

describe('Piloswine', () => {
  test('Rising Lunge does 30, or 60 on heads', () => {
    const seen = new Set<number>();
    for (let seed = 1; seed < 40; seed++) {
      const { s: s0, me, opp } = game(spec, spec, { seed });
      swapActiveTo(s0, me, PILOSWINE);
      tank(s0, opp);
      attachFromDeck(s0, me, WATER);
      attachFromDeck(s0, me, WATER);
      seen.add(dealt(attack(s0, 0), opp));
    }
    expect(seen).toEqual(new Set([30, 60]));
  });
});

describe('Mamoswine', () => {
  const prepare = (withStadium: boolean) => {
    const { s, me, opp } = game(spec);
    swapActiveTo(s, me, MAMOSWINE);
    tank(s, opp);
    for (let i = 0; i < 4; i++) attachFromDeck(s, me, WATER);
    if (withStadium) s.stadium = { uid: s.players[opp].deck.shift()!, owner: opp };
    return { s, me, opp };
  };

  test('Wreck does 120, or 240 and discards a Stadium in play', () => {
    const plain = prepare(false);
    expect(dealt(attack(plain.s, 0), plain.opp)).toBe(120);
    const withStadium = prepare(true);
    const after = attack(withStadium.s, 0);
    expect(dealt(after, withStadium.opp)).toBe(240);
    expect(after.stadium).toBeNull();
  });

  test('Blizzard Edge does 200 and discards 2 Energy from Mamoswine', () => {
    const { s: s0, me, opp } = prepare(false);
    const before = s0.players[me].active!.energy.length;
    const s = resolvePrompts(attack(s0, 1));
    expect(dealt(s, opp)).toBe(200);
    expect(s.players[me].active!.energy.length).toBe(before - 2);
  });
});
