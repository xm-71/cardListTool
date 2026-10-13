import { CREDITS } from '@ptcg/economy';
import { describe, expect, test } from 'vitest';
import { DECKS, deckById } from '../src/game/catalog.ts';
import { grantDeck, purchaseProblem } from '../src/profile/ownedDecks.ts';
import { newProfile, normalizeProfile, type Profile } from '../src/profile/types.ts';

const raw = (p: Partial<Profile> = {}) => ({ version: 1 as const, ...p });
const total = (c: Record<string, number>) => Object.values(c).reduce((a, b) => a + b, 0);
const theme = DECKS.find((d) => d.kind === 'theme')!;
const ready = (p: Partial<Profile> = {}): Profile =>
  normalizeProfile(raw({ introDone: true, starterDeck: 'mega-gengar', ...p }));

describe('upgrading a save', () => {
  test('a new profile owns nothing', () => {
    const p = normalizeProfile(newProfile());
    expect(p.ownedDecks).toEqual([]);
    expect(p.collection).toEqual({});
  });

  test('an old save with a finished intro owns its starter and gets its 60 cards', () => {
    const p = normalizeProfile(
      raw({ introDone: true, starterDeck: 'mega-diancie', collection: { 'me01-001': 2 } }),
    );
    expect(p.ownedDecks).toEqual(['mega-diancie']);
    expect(total(p.collection)).toBe(62);
    for (const c of deckById('mega-diancie').list.cards)
      expect(p.collection[c.id] ?? 0).toBeGreaterThanOrEqual(c.count);
  });

  test('the starter is granted once: normalizing again changes nothing', () => {
    const once = normalizeProfile(raw({ introDone: true, starterDeck: 'mega-lucario' }));
    expect(normalizeProfile(once)).toEqual(once);
  });

  test('a finished intro with no or an unknown starter owns Mega Gengar', () => {
    expect(normalizeProfile(raw({ introDone: true, starterDeck: null })).ownedDecks).toEqual(['mega-gengar']);
    expect(normalizeProfile(raw({ introDone: true, starterDeck: 'nope' })).ownedDecks).toEqual([
      'mega-gengar',
    ]);
  });

  test('the saved starter becomes the deck that was actually granted', () => {
    expect(normalizeProfile(raw({ introDone: true, starterDeck: 'nope' })).starterDeck).toBe('mega-gengar');
    expect(normalizeProfile(raw({ introDone: true, starterDeck: null })).starterDeck).toBe('mega-gengar');
  });

  test('a profile that only sets introDone (as the screen tests do) owns Mega Gengar', () => {
    expect(normalizeProfile({ ...newProfile(), introDone: true }).ownedDecks).toEqual(['mega-gengar']);
  });

  test('an unfinished intro owns nothing', () => {
    expect(normalizeProfile(raw({ introDone: false, starterDeck: 'mega-gengar' })).ownedDecks).toEqual([]);
  });

  test('unknown and duplicate owned ids are dropped', () => {
    const p = normalizeProfile(raw({ introDone: true, ownedDecks: ['mega-gengar', 'gone', 'mega-gengar'] }));
    expect(p.ownedDecks).toEqual(['mega-gengar']);
  });
});

describe('grantDeck', () => {
  test('adds the deck and its cards; granting again changes nothing', () => {
    const p = ready();
    const before = total(p.collection);
    const next = grantDeck(p, theme.id);
    expect(next.ownedDecks).toEqual([...p.ownedDecks, theme.id]);
    expect(total(next.collection)).toBe(before + 60);
    expect(grantDeck(next, theme.id)).toBe(next);
  });
});

describe('purchaseProblem', () => {
  test('says why a purchase is not allowed, or null when it is', () => {
    const price = CREDITS.deckPrices.theme;
    expect(purchaseProblem(ready({ credits: price }), 'not-a-deck')).toBe('Unknown deck');
    expect(purchaseProblem(ready({ credits: price, collectorMode: true }), theme.id)).toBe(
      'Decks are not sold in Collector mode',
    );
    expect(purchaseProblem(ready({ credits: price }), 'mega-gengar')).toBe('Already owned');
    expect(purchaseProblem(ready({ credits: price - 1 }), theme.id)).toBe('Not enough credits');
    expect(purchaseProblem(ready({ credits: price }), theme.id)).toBeNull();
  });
});
