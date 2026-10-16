import { describe, expect, test } from 'vitest';
import { deckOf, miniRegistry, pokemon } from '@ptcg/engine/testing';
import { GYM_DECKS, buildRegistry, metaCrustleDeck, metaDragapultDeck } from '@ptcg/cards';
import { DECK_PLANS } from '../src/plans.ts';
import { deckPlan } from '../src/plan.ts';

const registry = buildRegistry();
const mini = miniRegistry([pokemon('t-basic-noatk', { attacks: [] })]);

describe('deckPlan', () => {
  test('Johto Lance has the Dragonite and Charizard ex lines', () => {
    const p = deckPlan(GYM_DECKS['johto-lance'], registry);
    expect(p.lines['Dragonite']).toEqual(['Dratini', 'Dragonair', 'Dragonite']);
    expect(p.lines['Charizard ex']).toEqual(['Charmander', 'Charmeleon', 'Charizard ex']);
    expect(p.attackers.length).toBeGreaterThanOrEqual(1);
    expect(p.attackers.length).toBeLessThanOrEqual(2);
  });
  test('Dragapult and Crustle', () => {
    const d = deckPlan(metaDragapultDeck, registry);
    expect(d.lines['Dragapult ex']).toEqual(['Dreepy', 'Drakloak', 'Dragapult ex']);
    expect(d.attackers).toContain('Dragapult ex');
    expect(deckPlan(metaCrustleDeck, registry).lines['Crustle']).toEqual(['Dwebble', 'Crustle']);
  });
  test('priority puts a missing evolution piece of an attacker line before support', () => {
    const d = deckPlan(metaDragapultDeck, registry);
    expect(d.support.length).toBeGreaterThan(0);
    expect(d.priority.indexOf('Drakloak')).toBeLessThan(d.priority.indexOf(d.support[0]!));
  });
  test('an override changes attackers and puts first names first', () => {
    DECK_PLANS['test override'] = { attackers: ['Dragonair'], first: ['Gyarados'] };
    const p = deckPlan({ ...GYM_DECKS['johto-lance'], name: 'test override' }, registry);
    expect(p.attackers).toEqual(['Dragonair']);
    expect(p.priority[0]).toBe('Gyarados');
    delete DECK_PLANS['test override'];
  });
  test('a deck with no attacks gives an empty attacker list', () => {
    expect(deckPlan(deckOf({ 't-basic-noatk': 20, 't-dark': 40 }), mini).attackers).toEqual([]);
  });
});
