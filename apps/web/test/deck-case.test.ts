import { describe, expect, test } from 'vitest';
import { DECKS, deckById, registry } from '../src/game/catalog.ts';
import {
  caseEntries,
  caseFilters,
  filterEntries,
  playableIn,
  resolveActiveDeck,
} from '../src/game/deckCase.ts';
import { newProfile, type CustomDeck, type Profile } from '../src/profile/types.ts';

const theme = DECKS.find((d) => d.kind === 'theme')!;
const goodCards = deckById('mega-lucario').list.cards.map((c) => ({ ...c }));
const good: CustomDeck = { id: 'a', name: 'Good', cards: goodCards };
const collectionFor = (cards: { id: string; count: number }[]) => {
  const out: Record<string, number> = {};
  for (const c of cards) out[c.id] = (out[c.id] ?? 0) + c.count;
  return out;
};
const profile = (p: Partial<Profile> = {}): Profile => ({
  ...newProfile(),
  introDone: true,
  ownedDecks: ['mega-gengar', theme.id],
  starterDeck: 'mega-gengar',
  collection: collectionFor([...goodCards, ...theme.list.cards]),
  ...p,
});

describe('resolveActiveDeck', () => {
  test('uses the saved owned premade deck', () => {
    expect(resolveActiveDeck(profile({ activeDeck: theme.id }))).toBe(theme.id);
  });
  test('uses a saved custom deck that can be played', () => {
    expect(resolveActiveDeck(profile({ decks: [good], activeDeck: 'custom:a' }))).toBe('custom:a');
  });
  test('falls back to the starter when the saved custom deck is gone', () => {
    expect(resolveActiveDeck(profile({ activeDeck: 'custom:gone' }))).toBe('mega-gengar');
  });
  test('falls back when the saved premade deck is not owned', () => {
    expect(resolveActiveDeck(profile({ activeDeck: 'mega-lucario' }))).toBe('mega-gengar');
  });
  test('falls back to the first owned deck when the starter is not owned', () => {
    expect(resolveActiveDeck(profile({ starterDeck: 'mega-lucario', ownedDecks: [theme.id] }))).toBe(
      theme.id,
    );
  });
  test('falls back when a saved custom deck is no longer valid', () => {
    const broken = { ...good, cards: good.cards.slice(1) };
    expect(resolveActiveDeck(profile({ decks: [broken], activeDeck: 'custom:a' }))).toBe('mega-gengar');
  });
  test('is null with nothing owned', () => {
    expect(resolveActiveDeck(profile({ ownedDecks: [], starterDeck: null }))).toBeNull();
  });
});

describe('caseEntries', () => {
  const broken: CustomDeck = { id: 'b', name: 'Broken', cards: good.cards.slice(1) };
  const entries = caseEntries(profile({ decks: [good, broken] }));
  test('owned premade first, then custom, one active', () => {
    expect(entries.map((e) => e.id)).toEqual(['mega-gengar', theme.id, 'custom:a', 'custom:b']);
    expect(entries.filter((e) => e.active)).toHaveLength(1);
    expect(entries[0]!.active).toBe(true);
  });
  test('a deck that cannot be played carries its first problem', () => {
    const e = entries.find((x) => x.id === 'custom:b')!;
    expect(e.problem).toMatch(/^Not a legal deck: /);
    expect(e.problem).toContain('needs 60');
    expect(entries.find((x) => x.id === 'custom:a')!.problem).toBeNull();
  });
  test('custom decks get a format; premade decks do not', () => {
    expect(entries.find((x) => x.id === 'custom:a')!.format).toBe('standard');
    expect(entries[0]!.format).toBeUndefined();
  });
  test('playableIn reports Standard and Gym separately', () => {
    expect(playableIn(good, collectionFor(goodCards))).toEqual({ standard: true, gym: true });
    expect(playableIn(broken, collectionFor(goodCards)).standard).toBe(false);
  });
});

describe('filters', () => {
  const entries = caseEntries(profile({ decks: [good] }));
  test('premade and custom', () => {
    expect(filterEntries(entries, 'premade').every((e) => e.kind !== 'custom')).toBe(true);
    expect(filterEntries(entries, 'custom').map((e) => e.id)).toEqual(['custom:a']);
    expect(filterEntries(entries, 'all')).toHaveLength(3);
  });
  test('by energy type', () => {
    const t = entries[0]!.type!;
    expect(filterEntries(entries, t).every((e) => e.type === t)).toBe(true);
  });
  test('Custom chip is hidden when there are no custom decks', () => {
    expect(caseFilters(caseEntries(profile()))).not.toContain('custom');
    expect(caseFilters(entries)).toEqual(expect.arrayContaining(['all', 'premade', 'custom']));
  });
  test('registry knows the cover cards', () => {
    expect(entries.every((e) => registry.defs[e.cover] !== undefined)).toBe(true);
  });
});
