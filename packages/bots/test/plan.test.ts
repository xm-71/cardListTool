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
  test('Lorelei plays Chien-Pao ex and the Baxcalibur line', () => {
    const p = deckPlan(GYM_DECKS.lorelei, registry);
    expect(p.attackers).toContain('Chien-Pao ex');
    expect(p.lines['Baxcalibur']).toEqual(['Frigibax', 'Arctibax', 'Baxcalibur']);
  });
  test('Agatha plays Gardevoir ex and the Ralts line', () => {
    const p = deckPlan(GYM_DECKS.agatha, registry);
    expect(p.lines['Gardevoir ex']).toEqual(['Ralts', 'Kirlia', 'Gardevoir ex']);
    expect(p.attackers.some((n) => n === 'Gardevoir ex' || n === 'Munkidori')).toBe(true);
  });
  test('Blue (Fire) plays Charizard ex with the Pidgeot ex engine', () => {
    const p = deckPlan(GYM_DECKS['blue-fire'], registry);
    expect(p.lines['Charizard ex']).toEqual(['Charmander', 'Charmeleon', 'Charizard ex']);
    expect(p.attackers).toContain('Charizard ex');
  });
  test('Blue (Grass) plays the Meganium line and Teal Mask Ogerpon ex', () => {
    const p = deckPlan(GYM_DECKS['blue-grass'], registry);
    expect(p.lines['Meganium']).toEqual(['Chikorita', 'Bayleef', 'Meganium']);
    expect(p.attackers.some((n) => n === 'Teal Mask Ogerpon ex' || n === 'Meganium')).toBe(true);
  });
  test('Blue (Water) plays Mega Greninja ex and the Froakie line', () => {
    const p = deckPlan(GYM_DECKS['blue-water'], registry);
    expect(p.lines['Mega Greninja ex']).toEqual(['Froakie', 'Frogadier', 'Mega Greninja ex']);
    expect(p.attackers).toContain('Mega Greninja ex');
  });
  test('Red plays Miraidon ex and Iron Hands ex as attackers', () => {
    const p = deckPlan(GYM_DECKS.red, registry);
    expect(p.attackers.some((n) => n === 'Miraidon ex' || n === 'Iron Hands ex')).toBe(true);
  });
  test('Will plays Lillie\'s Clefairy ex', () => {
    const p = deckPlan(GYM_DECKS.will, registry);
    expect(p.attackers).toContain("Lillie's Clefairy ex");
  });
  test('Johto Koga plays Roaring Moon ex and Pecharunt ex', () => {
    const p = deckPlan(GYM_DECKS['johto-koga'], registry);
    expect(p.attackers.some((n) => n === 'Roaring Moon ex' || n === 'Pecharunt ex')).toBe(true);
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
