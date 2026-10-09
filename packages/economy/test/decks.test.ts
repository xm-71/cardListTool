import { describe, expect, test } from 'vitest';
import type { CardRegistry, DeckList } from '@ptcg/engine';
import { buildRegistry, isPlayable, setCards } from '@ptcg/cards';
import {
  deckFormat,
  isDeckUsable,
  isGymLegal,
  isStandardLegal,
  validateCustomDeck,
  validateGymDeck,
} from '../src/index.ts';

const base = buildRegistry();
// A same-name reprint of Ultra Ball, to check that the 4-per-name rule counts reprints together.
const registry: CardRegistry = {
  defs: { ...base.defs, 'me99-131': { ...base.defs['me01-131']!, id: 'me99-131' } },
  scripts: { ...base.scripts, 'me99-131': base.scripts['me01-131']! },
};

const GASTLY = 'me02-054';
const PSYCHIC = 'mee-005';
const unplayableDef = () =>
  setCards('me01').find((c) => c.category === 'Trainer' && !isPlayable(c, registry))!;
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

describe('isDeckUsable', () => {
  test('a playable Standard card is usable', () => {
    expect(isDeckUsable(registry.defs[GASTLY]!, registry)).toBe(true);
  });
  test('Basic Energy is usable', () => {
    expect(isDeckUsable(registry.defs[PSYCHIC]!, registry)).toBe(true);
  });
  test('a classic card is not usable, even one with no card text', () => {
    const vanilla = setCards('base1').find(
      (c) => c.category === 'Pokemon' && c.abilities.length === 0 && c.attacks.every((a) => a.text === ''),
    )!;
    expect(vanilla).toBeDefined();
    expect(isPlayable(vanilla, registry)).toBe(true);
    expect(isDeckUsable(vanilla, registry)).toBe(false);
  });
  test('an unscripted Standard card is not usable', () => {
    expect(isDeckUsable(unplayableDef(), registry)).toBe(false);
  });
});

describe('Gym format', () => {
  // Weedle (151) has no card text, so the engine can already play it: only its legality is in question.
  const WEEDLE = 'sv03.5-013';
  const withWeedle = (): DeckList => ({
    name: 'Gym test',
    cards: [
      { id: WEEDLE, count: 4 },
      { id: GASTLY, count: 4 },
      { id: PSYCHIC, count: 52 },
    ],
  });
  const own = { ...owned, [WEEDLE]: 4 };

  test('a 151 card is Gym-legal but not Standard-legal', () => {
    const weedle = registry.defs[WEEDLE]!;
    expect(isStandardLegal(weedle)).toBe(false);
    expect(isGymLegal(weedle)).toBe(true);
  });

  test('a regulation-G card from another set is neither', () => {
    const other = Object.values(registry.defs).find(
      (d) => d.regulationMark === 'G' && !d.id.startsWith('sv03.5-'),
    );
    expect(other, 'fixture: some regulation G card outside 151').toBeDefined();
    expect(isStandardLegal(other!)).toBe(false);
    expect(isGymLegal(other!)).toBe(false);
  });

  test('Basic Energy and mark-H cards are legal in both', () => {
    for (const id of [PSYCHIC, 'me01-131']) {
      expect(isStandardLegal(registry.defs[id]!), id).toBe(true);
      expect(isGymLegal(registry.defs[id]!), id).toBe(true);
    }
  });

  test('validateGymDeck accepts a 151 deck that validateCustomDeck rejects by name', () => {
    expect(validateGymDeck(withWeedle(), registry, own)).toEqual([]);
    expect(validateCustomDeck(withWeedle(), registry, own)).toEqual(['Weedle (G) is not legal in Standard']);
  });

  test('both formats reject 5 copies of a name and a deck with no Basic Pokémon', () => {
    const five: DeckList = {
      name: 'Five',
      cards: [
        { id: WEEDLE, count: 5 },
        { id: PSYCHIC, count: 55 },
      ],
    };
    const manyOwned = { ...own, [WEEDLE]: 5 };
    expect(validateGymDeck(five, registry, manyOwned)).toContain('More than 4 Weedle');
    expect(validateCustomDeck(five, registry, manyOwned)).toContain('More than 4 Weedle');
    const noBasic: DeckList = { name: 'None', cards: [{ id: PSYCHIC, count: 60 }] };
    expect(validateGymDeck(noBasic, registry, own)).toContain('No Basic Pokémon');
    expect(validateCustomDeck(noBasic, registry, own)).toContain('No Basic Pokémon');
  });

  test('validateGymDeck still wants playable cards, enough copies and 60 cards', () => {
    const short = withWeedle();
    short.cards[2]!.count -= 1;
    expect(validateGymDeck(short, registry, own)).toContain('Deck has 59 cards (needs 60)');
    expect(validateGymDeck(withWeedle(), registry, { ...own, [WEEDLE]: 1 })).toContain(
      'You own 1 Weedle but the deck uses 4',
    );
    const unplayable = Object.values(registry.defs).find(
      (d) => d.id.startsWith('sv03.5-') && d.category === 'Pokemon' && !isPlayable(d, registry),
    )!;
    const d: DeckList = {
      name: 'U',
      cards: [{ id: unplayable.id, count: 1 }, ...withWeedle().cards.slice(0, 2), { id: PSYCHIC, count: 51 }],
    };
    expect(validateGymDeck(d, registry, { ...own, [unplayable.id]: 1 })).toContain(
      `${unplayable.name} isn't playable yet`,
    );
  });

  test('deckFormat is standard until a card needs the Gym format', () => {
    expect(deckFormat(deck([{ id: 'me01-131', count: 4 }]), registry)).toBe('standard');
    expect(deckFormat(withWeedle(), registry)).toBe('gym');
  });
});
