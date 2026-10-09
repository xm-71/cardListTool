import { describe, expect, test } from 'vitest';
import {
  MAX_BINDERS,
  MAX_PAGES,
  addPage,
  cardCount,
  missingSlots,
  moveCard,
  newBinder,
  normalizeBinder,
  placeCard,
  placementsLeft,
  removeCard,
  removePage,
} from '../src/profile/binders.ts';
import { normalizeProfile, type CustomBinder } from '../src/profile/types.ts';

const BALL = 'me01-131';
const LUCARIO = 'me01-077';
const empty = () => Array<string | null>(9).fill(null);

describe('newBinder', () => {
  test('has the default look and one empty page', () => {
    expect(newBinder('b1', 5)).toEqual({
      id: 'b1',
      name: 'My binder',
      coverColor: 'red',
      pageColor: 'cream',
      background: 'plain',
      stickers: {},
      pages: [empty()],
      updatedAt: 5,
    });
  });
});

describe('placing cards', () => {
  test('a card can be placed as many times as it is owned, and no more', () => {
    const owned = { [BALL]: 2 };
    let b = placeCard(newBinder('b', 0), 0, 0, BALL, owned);
    b = placeCard(b, 0, 1, BALL, owned);
    expect(b.pages[0]!.slice(0, 2)).toEqual([BALL, BALL]);
    expect(placementsLeft(b, BALL, owned)).toBe(0);
    expect(placeCard(b, 0, 2, BALL, owned)).toBe(b);
  });

  test('placing onto a filled slot replaces that card and frees its placement', () => {
    const owned = { [BALL]: 1, [LUCARIO]: 1 };
    let b = placeCard(newBinder('b', 0), 0, 0, BALL, owned);
    b = placeCard(b, 0, 0, LUCARIO, owned);
    expect(b.pages[0]![0]).toBe(LUCARIO);
    expect(placementsLeft(b, BALL, owned)).toBe(1);
  });

  test('re-placing a card into its own slot is allowed', () => {
    const owned = { [BALL]: 1 };
    const b = placeCard(newBinder('b', 0), 0, 0, BALL, owned);
    expect(placeCard(b, 0, 0, BALL, owned).pages[0]![0]).toBe(BALL);
  });

  test('the input binder is never changed', () => {
    const b = newBinder('b', 0);
    placeCard(b, 0, 0, BALL, { [BALL]: 1 });
    expect(b.pages[0]![0]).toBeNull();
  });
});

describe('moving and removing', () => {
  test('moveCard swaps two filled slots and moves into an empty one', () => {
    const owned = { [BALL]: 1, [LUCARIO]: 1 };
    let b = placeCard(newBinder('b', 0), 0, 0, BALL, owned);
    b = placeCard(b, 0, 1, LUCARIO, owned);
    b = moveCard(b, { page: 0, slot: 0 }, { page: 0, slot: 1 });
    expect(b.pages[0]!.slice(0, 2)).toEqual([LUCARIO, BALL]);
    b = moveCard(b, { page: 0, slot: 1 }, { page: 0, slot: 8 });
    expect(b.pages[0]![1]).toBeNull();
    expect(b.pages[0]![8]).toBe(BALL);
  });

  test('removeCard empties a slot', () => {
    const b = placeCard(newBinder('b', 0), 0, 3, BALL, { [BALL]: 1 });
    expect(removeCard(b, 0, 3).pages[0]![3]).toBeNull();
    expect(cardCount(b)).toBe(1);
  });
});

describe('pages', () => {
  test(`addPage stops at ${MAX_PAGES} pages`, () => {
    let b = newBinder('b', 0);
    for (let i = 0; i < MAX_PAGES + 5; i++) b = addPage(b);
    expect(b.pages).toHaveLength(MAX_PAGES);
  });

  test('removePage drops the cards on that page; the last page cannot be removed', () => {
    let b = addPage(newBinder('b', 0));
    b = placeCard(b, 1, 0, BALL, { [BALL]: 1 });
    b = removePage(b, 1);
    expect(b.pages).toHaveLength(1);
    expect(cardCount(b)).toBe(0);
    expect(removePage(b, 0)).toBe(b);
  });
});

test('slots beyond the owned count are missing, latest first', () => {
  const b: CustomBinder = {
    ...newBinder('b', 0),
    pages: [
      [BALL, null, BALL, ...empty().slice(3)],
      [BALL, ...empty().slice(1)],
    ],
  };
  expect(missingSlots(b, { [BALL]: 1 })).toEqual(new Set(['0:2', '1:0']));
});

describe('normalizeBinder', () => {
  const base = { ...newBinder('b', 1) };

  test('bad colours and stickers fall back; pages are made 9 slots; names are cleaned', () => {
    const b = normalizeBinder({
      ...base,
      coverColor: 'gold',
      pageColor: 'blue',
      stickers: { topLeft: 'star', topRight: 'unicorn' },
      pages: [[BALL, null, null, null, null], Array(12).fill(null), [1, null]],
      name: 'A very long binder name indeed',
    })!;
    expect(b.coverColor).toBe('red');
    expect(b.pageColor).toBe('blue');
    expect(b.stickers).toEqual({ topLeft: 'star' });
    expect(b.pages.map((p) => p.length)).toEqual([9, 9, 9]);
    expect(b.pages[0]![0]).toBe(BALL);
    expect(b.pages[2]![0]).toBeNull();
    expect(b.name).toBe('A very long binder n');
  });

  test('empty pages and names get defaults; non-objects are rejected', () => {
    const b = normalizeBinder({ ...base, pages: [], name: '  ' })!;
    expect(b.pages).toEqual([empty()]);
    expect(b.name).toBe('My binder');
    expect(normalizeBinder(null)).toBeNull();
    expect(normalizeBinder('x')).toBeNull();
    expect(normalizeBinder({ ...base, id: 3 })).toBeNull();
  });
});

describe('normalizeProfile', () => {
  test('old profiles get no binders and collector mode off', () => {
    const p = normalizeProfile({ version: 1 });
    expect(p.binders).toEqual([]);
    expect(p.collectorMode).toBe(false);
  });

  test('bad binder entries are dropped and the count is capped', () => {
    const many = Array.from({ length: MAX_BINDERS + 3 }, (_, i) => newBinder(`b${i}`, i));
    expect(normalizeProfile({ version: 1, binders: ['x' as never, many[0]!] }).binders).toHaveLength(1);
    expect(normalizeProfile({ version: 1, binders: many }).binders).toHaveLength(MAX_BINDERS);
    expect(normalizeProfile({ version: 1, collectorMode: 'yes' as never }).collectorMode).toBe(false);
  });
});
