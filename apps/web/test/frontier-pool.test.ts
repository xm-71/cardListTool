import { describe, expect, test } from 'vitest';
import type { CardDef, DeckList } from '@ptcg/engine';
import { DARK, ITEM, miniRegistry, pokemon } from '@ptcg/engine/testing';
import { isPlayable } from '@ptcg/cards';
import { registry } from '../src/game/catalog.ts';
import { buildPool, frontierPool, type FrontierPackage } from '../src/game/frontier/pool.ts';

const trainer = (id: string, isAceSpec = false): CardDef => ({ ...ITEM, id, name: id, isAceSpec }) as CardDef;
const special = (id: string): CardDef => ({ ...DARK, id, name: id, energyKind: 'Special' }) as CardDef;

const defs: CardDef[] = [
  pokemon('b1', { name: 'Seedling', stage: 'Basic' }),
  pokemon('s1', { name: 'Sprout', stage: 'Stage1', evolvesFrom: 'Seedling' }),
  pokemon('s2', { name: 'Bloom', stage: 'Stage2', evolvesFrom: 'Sprout', isEx: true }),
  pokemon('bb', { name: 'Bunny', stage: 'Basic' }),
  pokemon('bx', { name: 'Hopper', stage: 'Stage1', evolvesFrom: 'Bunny' }),
  pokemon('bm', { name: 'Mega Hopper ex', stage: 'Stage1', evolvesFrom: 'Bunny', isMega: true }),
  pokemon('solo', { name: 'Loner', stage: 'Basic' }),
  pokemon('once', { name: 'Single', stage: 'Basic' }),
  trainer('ball'),
  trainer('rare'),
  trainer('ace', true),
  special('spe'),
];
const scripts = {
  ball: { trainer: { play() {} } },
  rare: { trainer: { play() {} } },
  ace: { trainer: { play() {} } },
  spe: {},
};
const reg = miniRegistry(defs, scripts as never);
const deck = (cards: Record<string, number>): DeckList => ({
  name: 'd',
  cards: Object.entries(cards).map(([id, count]) => ({ id, count })),
});
const find = (pool: FrontierPackage[], ...ids: string[]) =>
  pool.find((p) => ids.every((id) => p.cards.some((c) => c.id === id)) && p.cards.length === ids.length);

describe('Frontier package pool', () => {
  test('a Stage 1 line includes the Basic it evolves from, in the counts the deck uses (Basic ≤ 2, Stage 1 ≤ 2)', () => {
    const pool = buildPool([deck({ bb: 4, bx: 3, 't-dark': 10 })], reg);
    expect(find(pool, 'bb', 'bx')?.cards).toEqual([
      { id: 'bb', count: 2 },
      { id: 'bx', count: 2 },
    ]);
    const one = buildPool([deck({ bb: 3, bx: 1 })], reg);
    expect(find(one, 'bb', 'bx')?.cards).toEqual([
      { id: 'bb', count: 2 },
      { id: 'bx', count: 1 },
    ]);
  });

  test('a Stage 2 line is 2-1-1 or 1-1-1 and includes both earlier stages', () => {
    const line = find(buildPool([deck({ b1: 3, s1: 2, s2: 2 })], reg), 'b1', 's1', 's2')!;
    expect(line.cards).toEqual([
      { id: 'b1', count: 2 },
      { id: 's1', count: 1 },
      { id: 's2', count: 1 },
    ]);
    expect(line.kind).toBe('line');
    const small = find(buildPool([deck({ b1: 1, s1: 1, s2: 1 })], reg), 'b1', 's1', 's2')!;
    expect(small.cards.map((c) => c.count)).toEqual([1, 1, 1]);
  });

  test('a branching Basic gives one package per top-stage card', () => {
    const pool = buildPool([deck({ bb: 4, bx: 2, bm: 2 })], reg);
    expect(find(pool, 'bb', 'bx')).toBeDefined();
    expect(find(pool, 'bb', 'bm')).toBeDefined();
    expect(pool.filter((p) => p.kind === 'line')).toHaveLength(2);
  });

  test('a non-evolving Basic is a 2-copy line, skipped if its deck has only 1', () => {
    const pool = buildPool([deck({ solo: 3, once: 1 })], reg);
    expect(find(pool, 'solo')).toMatchObject({ kind: 'line', cards: [{ id: 'solo', count: 2 }] });
    expect(find(pool, 'once')).toBeUndefined();
  });

  test('Trainers are 2-copy packages and 1-copy Trainers are skipped; an ACE SPEC is a 1-card "ace" package', () => {
    const pool = buildPool([deck({ ball: 4, rare: 1, ace: 1 })], reg);
    expect(find(pool, 'ball')).toMatchObject({
      kind: 'trainers',
      tier: 'plain',
      cards: [{ id: 'ball', count: 2 }],
    });
    expect(find(pool, 'rare')).toBeUndefined();
    expect(find(pool, 'ace')).toMatchObject({
      kind: 'trainers',
      tier: 'ace',
      cards: [{ id: 'ace', count: 1 }],
    });
  });

  test('Special Energy is a 2-copy package; basic Energy is never offered', () => {
    const pool = buildPool([deck({ spe: 3, 't-dark': 20 })], reg);
    expect(find(pool, 'spe')).toMatchObject({ kind: 'energy', cards: [{ id: 'spe', count: 2 }] });
    expect(pool.some((p) => p.cards.some((c) => c.id === 't-dark'))).toBe(false);
  });

  test('a package with an ex or Mega Pokémon has tier "ex"', () => {
    const pool = buildPool([deck({ b1: 2, s1: 2, s2: 2, bb: 2, bm: 2, bx: 2 })], reg);
    expect(find(pool, 'b1', 's1', 's2')?.tier).toBe('ex');
    expect(find(pool, 'bb', 'bm')?.tier).toBe('ex');
    expect(find(pool, 'bb', 'bx')?.tier).toBe('plain');
  });

  test('packages with the same cards from different decks appear once', () => {
    const pool = buildPool([deck({ ball: 2 }), deck({ ball: 3 })], reg);
    expect(pool.filter((p) => p.cards[0]!.id === 'ball')).toHaveLength(1);
  });

  test('real catalog: every card isPlayable, 2-4 cards per package (ACE: 1), at least 100 packages, at least 3 ACE packages', () => {
    const pool = frontierPool();
    expect(pool.length).toBeGreaterThanOrEqual(100);
    expect(pool.filter((p) => p.tier === 'ace').length).toBeGreaterThanOrEqual(3);
    for (const p of pool) {
      const size = p.cards.reduce((n, c) => n + c.count, 0);
      if (p.tier === 'ace') expect(size, p.id).toBe(1);
      else {
        expect(size, p.id).toBeGreaterThanOrEqual(2);
        expect(size, p.id).toBeLessThanOrEqual(4);
      }
      for (const c of p.cards) expect(isPlayable(registry.defs[c.id]!, registry), c.id).toBe(true);
    }
    expect(new Set(pool.map((p) => p.id)).size).toBe(pool.length);
  });
});
