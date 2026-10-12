import { describe, expect, test } from 'vitest';
import { DECKS, registry } from '../src/game/catalog.ts';
import { LEADERS } from '../src/game/gym.ts';
import { FRONTIER_BRAINS, drawOpponents, opponentDeck } from '../src/game/frontier/opponents.ts';

const starters = DECKS.filter((d) => d.kind === 'starter').map((d) => d.id);
const kindOf = (o: { source: string; id: string }) =>
  o.source === 'gym' ? 'gym' : DECKS.find((d) => d.id === o.id)!.kind;

describe('Frontier opponents', () => {
  test('draws 8 opponents: difficulties easy x3, medium x3, hard x2', () => {
    expect(drawOpponents(1, 'mega-gengar').map((o) => o.difficulty)).toEqual([
      'easy',
      'easy',
      'easy',
      'medium',
      'medium',
      'medium',
      'hard',
      'hard',
    ]);
  });

  test('no deck repeats in a run, and none is the starter the player picked', () => {
    for (const starter of starters)
      for (let seed = 1; seed <= 200; seed++) {
        const ids = drawOpponents(seed, starter).map((o) => `${o.source}:${o.id}`);
        expect(new Set(ids).size).toBe(8);
        expect(ids).not.toContain(`catalog:${starter}`);
      }
  });

  test('fights 7 and 8 are meta decks; fights 1-3 are starter or theme decks; fights 4-6 are theme, Gym Leader or meta decks', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const o = drawOpponents(seed, 'mega-lucario');
      for (const x of o.slice(0, 3)) expect(['starter', 'theme']).toContain(kindOf(x));
      for (const x of o.slice(3, 6)) expect(['theme', 'gym', 'meta']).toContain(kindOf(x));
      for (const x of o.slice(6)) expect(kindOf(x)).toBe('meta');
    }
  });

  test('the boss carries a brain whose key matches its meta deck', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const o = drawOpponents(seed, 'mega-diancie');
      const boss = o[7]!;
      expect(boss.brain).toBe(FRONTIER_BRAINS[boss.id]!.name);
      expect(o.slice(0, 7).every((x) => x.brain === undefined)).toBe(true);
    }
    expect(Object.keys(FRONTIER_BRAINS).sort()).toEqual(
      DECKS.filter((d) => d.kind === 'meta')
        .map((d) => d.id)
        .sort(),
    );
  });

  test('every opponent has a name, type and a cover card in the registry', () => {
    for (let seed = 1; seed <= 100; seed++)
      for (const o of drawOpponents(seed, 'mega-gengar')) {
        expect(o.name.length).toBeGreaterThan(0);
        expect(o.type.length).toBeGreaterThan(0);
        expect(registry.defs[o.cover], o.cover).toBeDefined();
        if (o.source === 'gym') expect(o.type).toBe(LEADERS.find((l) => l.id === o.id)!.type);
      }
  });

  test('same seed gives the same opponents', () => {
    expect(drawOpponents(9, 'mega-gengar')).toEqual(drawOpponents(9, 'mega-gengar'));
    expect(drawOpponents(9, 'mega-gengar')).not.toEqual(drawOpponents(10, 'mega-gengar'));
  });

  test('opponentDeck resolves every drawn opponent to a 60-card deck', () => {
    for (let seed = 1; seed <= 100; seed++)
      for (const o of drawOpponents(seed, 'mega-lucario'))
        expect(opponentDeck(o).cards.reduce((n, c) => n + c.count, 0)).toBe(60);
  });
});
