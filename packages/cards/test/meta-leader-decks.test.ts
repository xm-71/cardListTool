import { expect, test } from 'vitest';
import type { DeckList } from '@ptcg/engine';
import { GYM_DECKS, metaDragapultDeck } from '../src/index.ts';
import { assertGymDeck } from './helpers.ts';

/** Elite Four leaders on meta decks: 60 playable cards from the leader pool (mark D+, 151, Mega) and the exact lists. */

test('Lorelei plays the Chien-Pao ex deck: 60 playable cards in the leader pool', () => {
  const deck = GYM_DECKS.lorelei as DeckList;
  assertGymDeck(deck, 'leader');
  expect(deck.name).toBe("Lorelei's Chien-Pao Deck");
  const counts = Object.fromEntries(deck.cards.map((c) => [c.id, c.count]));
  expect(counts).toEqual({
    'sv02-061': 4,
    'sv02-057': 4,
    'sv02-059': 2,
    'sv02-060': 3,
    'sv09-155': 4,
    'sv02-185': 1,
    'me01-114': 3,
    'me01-131': 4,
    'sv01-181': 4,
    'me01-125': 4,
    'me01-167': 4,
    'mee-003': 22,
    'sv01-166': 1,
  });
});

test("Bruno plays the Mega Lucario ex deck: 60 playable cards in the leader pool", () => {
  const deck = GYM_DECKS.bruno as DeckList;
  assertGymDeck(deck, 'leader');
  expect(deck.name).toBe("Bruno's Mega Lucario Deck");
  const counts = Object.fromEntries(deck.cards.map((c) => [c.id, c.count]));
  expect(counts).toEqual({
    'me01-076': 4,
    'me01-077': 2,
    'me01-072': 2,
    'me01-073': 2,
    'me01-075': 2,
    'me01-074': 2,
    'sv06.5-038': 1,
    'me01-119': 2,
    'me01-114': 1,
    'sv02-185': 1,
    'me01-131': 3,
    'me01-167': 2,
    'me01-116': 3,
    'me01-124': 1,
    'me01-173': 1,
    'me01-130': 3,
    'me01-166': 1,
    'mee-006': 27,
  });
});

test("Lance plays the Dragapult ex deck: 60 playable cards in the leader pool, the Worlds 2026 list's cards", () => {
  const deck = GYM_DECKS.lance as DeckList;
  assertGymDeck(deck, 'leader');
  expect(deck.name).toBe("Lance's Dragapult Deck");
  const counts = (d: DeckList) => Object.fromEntries(d.cards.map((c) => [c.id, c.count]));
  expect(counts(deck)).toEqual(counts(metaDragapultDeck));
});

test('Agatha plays the Gardevoir ex deck: 60 playable cards in the leader pool', () => {
  const deck = GYM_DECKS.agatha as DeckList;
  assertGymDeck(deck, 'leader');
  expect(deck.name).toBe("Agatha's Gardevoir Deck");
  const counts = Object.fromEntries(deck.cards.map((c) => [c.id, c.count]));
  expect(counts).toEqual({
    'me01-058': 4,
    'me01-059': 4,
    'sv01-086': 3,
    'sv06-095': 4,
    'sv09-056': 1,
    'sv06.5-038': 1,
    'sv09-155': 4,
    'sv02-185': 4,
    'sv01-166': 2,
    'me01-131': 4,
    'sv04-163': 3,
    'me01-125': 3,
    'me01-173': 2,
    'sv01-181': 3,
    'sv02-188': 1,
    'sv06-163': 1,
    'mee-005': 12,
    'mee-007': 4,
  });
});

test("Blue plays the Charizard ex deck (Fire): 60 playable cards in the leader pool", () => {
  const deck = GYM_DECKS['blue-fire'] as DeckList;
  assertGymDeck(deck, 'leader');
  expect(deck.name).toBe("Blue's Charizard Deck");
  const counts = Object.fromEntries(deck.cards.map((c) => [c.id, c.count]));
  expect(counts).toEqual({
    'sv03-026': 3,
    'sv03-027': 1,
    'sv03-125': 3,
    'sv03-162': 2,
    'sv03-163': 1,
    'sv03-164': 2,
    'sv03.5-151': 1,
    'sv06.5-038': 1,
    'sv01-166': 4,
    'me01-114': 2,
    'sv02-185': 2,
    'sv09-155': 2,
    'me01-119': 2,
    'me01-125': 4,
    'me01-131': 3,
    'sv01-181': 4,
    'me01-167': 2,
    'sv02-188': 1,
    'me01-173': 1,
    'me01-130': 1,
    'sv05-157': 1,
    'me01-166': 1,
    'mee-002': 16,
  });
});

test("Blue plays the Teal Mask Ogerpon ex and Meganium deck (Grass): 60 playable cards in the leader pool", () => {
  const deck = GYM_DECKS['blue-grass'] as DeckList;
  assertGymDeck(deck, 'leader');
  expect(deck.name).toBe("Blue's Ogerpon Deck");
  const counts = Object.fromEntries(deck.cards.map((c) => [c.id, c.count]));
  expect(counts).toEqual({
    'sv06-025': 4,
    'me01-008': 4,
    'me01-009': 2,
    'me01-010': 2,
    'sv06.5-038': 1,
    'sv01-166': 4,
    'sv09-155': 4,
    'sv02-185': 2,
    'me01-114': 3,
    'sv01-181': 4,
    'me01-131': 4,
    'me01-125': 3,
    'me01-167': 3,
    'sv02-188': 1,
    'me01-130': 1,
    'mee-001': 16,
    'me01-173': 2,
  });
});

test("Blue plays the Mega Greninja ex deck (Water): 60 playable cards in the leader pool", () => {
  const deck = GYM_DECKS['blue-water'] as DeckList;
  assertGymDeck(deck, 'leader');
  expect(deck.name).toBe("Blue's Mega Greninja Deck");
  const counts = Object.fromEntries(deck.cards.map((c) => [c.id, c.count]));
  expect(counts).toEqual({
    'me04-020': 4,
    'me04-021': 3,
    'me04-022': 3,
    'me03-020': 2,
    'me03-021': 2,
    'sv06.5-038': 1,
    'sv09-155': 4,
    'sv02-185': 2,
    'me01-114': 2,
    'sv01-166': 2,
    'me01-131': 4,
    'sv01-181': 4,
    'me01-125': 3,
    'sv04-163': 3,
    'me01-167': 2,
    'me01-173': 1,
    'sv02-188': 1,
    'me01-130': 1,
    'mee-003': 16,
  });
});

test("Red plays the Miraidon ex deck: 60 playable cards in the leader pool", () => {
  const deck = GYM_DECKS.red as DeckList;
  assertGymDeck(deck, 'leader');
  expect(deck.name).toBe("Red's Miraidon Deck");
  const counts = Object.fromEntries(deck.cards.map((c) => [c.id, c.count]));
  expect(counts).toEqual({
    'sv01-081': 3,
    'sv04-070': 4,
    'sv03.5-145': 3,
    'sv06.5-038': 1,
    'sv01-166': 4,
    'me01-114': 3,
    'sv02-185': 3,
    'sv09-155': 4,
    'sv01-170': 4,
    'sv01-181': 4,
    'me01-131': 4,
    'me01-130': 2,
    'sv05-157': 1,
    'me01-173': 3,
    'me01-166': 1,
    'mee-004': 16,
  });
});
