import { describe, expect, test } from 'vitest';
import type { CardRegistry, DeckList } from '@ptcg/engine';
import { buildRegistry, isPlayable, setCards } from '@ptcg/cards';
import { validateCustomDeck } from '../src/index.ts';

const base = buildRegistry();
// A same-name reprint of Ultra Ball, to check that the 4-per-name rule counts reprints together.
const registry: CardRegistry = {
  defs: { ...base.defs, 'me99-131': { ...base.defs['me01-131']!, id: 'me99-131' } },
  scripts: { ...base.scripts, 'me99-131': base.scripts['me01-131']! },
};

const GASTLY = 'me02-054';
const PSYCHIC = 'mee-005';
const owned: Record<string, number> = {
  [GASTLY]: 4,
  'me01-131': 4,
  'me99-131': 4,
  'sv06-163': 2,
  'sv01-166': 4,
};

function deck(extra: { id: string; count: number }[]): DeckList {
  const used = extra.reduce((n, c) => n + c.count, 0);
  return { name: 'Test', cards: [{ id: GASTLY, count: 4 }, ...extra, { id: PSYCHIC, count: 56 - used }] };
}

describe('validateCustomDeck', () => {
  test('a legal deck has no problems', () => {
    expect(validateCustomDeck(deck([{ id: 'me01-131', count: 4 }]), registry, owned)).toEqual([]);
  });

  test('needs exactly 60 cards', () => {
    const d = deck([]);
    d.cards[1]!.count -= 1;
    expect(validateCustomDeck(d, registry, owned)).toContain('Deck has 59 cards (needs 60)');
  });

  test('at most 4 of a name, counting reprints together', () => {
    const d = deck([
      { id: 'me01-131', count: 3 },
      { id: 'me99-131', count: 2 },
    ]);
    expect(validateCustomDeck(d, registry, owned)).toContain('More than 4 Ultra Ball');
  });

  test('Basic Energy is unlimited and needs no owning', () => {
    expect(validateCustomDeck(deck([]), registry, {})).toEqual(['You own 0 Gastly but the deck uses 4']);
  });

  test('needs a Basic Pokémon', () => {
    const d: DeckList = { name: 'Energy', cards: [{ id: PSYCHIC, count: 60 }] };
    expect(validateCustomDeck(d, registry, owned)).toContain('No Basic Pokémon');
  });

  test('at most 1 ACE SPEC', () => {
    expect(validateCustomDeck(deck([{ id: 'sv06-163', count: 2 }]), registry, owned)).toContain(
      'More than 1 ACE SPEC',
    );
  });

  test('regulation mark H or later', () => {
    expect(validateCustomDeck(deck([{ id: 'sv01-166', count: 1 }]), registry, owned)).toContain(
      'Arven (G) is not legal in Standard',
    );
  });

  test('every card must be playable', () => {
    const unplayable = setCards('me01').find((c) => c.category === 'Trainer' && !isPlayable(c, registry))!;
    const problems = validateCustomDeck(deck([{ id: unplayable.id, count: 1 }]), registry, {
      ...owned,
      [unplayable.id]: 1,
    });
    expect(problems).toEqual([`${unplayable.name} isn't playable yet`]);
  });

  test('every card must be owned in that quantity', () => {
    expect(
      validateCustomDeck(deck([{ id: 'me01-131', count: 4 }]), registry, { ...owned, 'me01-131': 3 }),
    ).toEqual(['You own 3 Ultra Ball but the deck uses 4']);
  });

  test('an unknown card id is reported', () => {
    expect(validateCustomDeck(deck([{ id: 'nope-1', count: 1 }]), registry, owned)).toContain(
      'Unknown card nope-1',
    );
  });
});
