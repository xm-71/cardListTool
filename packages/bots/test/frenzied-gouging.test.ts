import { describe, expect, test } from 'vitest';
import { createEngine, type GameState } from '@ptcg/engine';
import { attachFromDeck, benchFromHand, finishSetup, giveCard, swapActiveTo } from '@ptcg/engine/testing';
import * as cards from '@ptcg/cards';
import { createSmartBot } from '../src/smart.ts';

const registry = cards.buildRegistry();
const engine = createEngine(registry);
const koga = cards.GYM_DECKS['johto-koga']!;
const agatha = cards.GYM_DECKS.agatha!;
const bot = createSmartBot(registry, [koga, agatha]);

const ROARING_MOON = 'sv04-124';
const BIG = 'sv01-086'; // Gardevoir ex: 310 HP, far more than Calamity Storm's 100
const BASIC = 'sv06-095';
const DARK = 'mee-007';

/** Koga's turn: Roaring Moon ex Active with 3 Darkness Energy against a big Defending Pokémon with a Benched one. */
function setup(): GameState {
  for (let seed = 3; ; seed++) {
    let s = finishSetup(engine, engine.createGame({ decks: [koga, agatha], seed }));
    if (s.first !== 0) continue;
    for (let i = 0; i < 2; i++) s = engine.applyAction(s, s.current, { type: 'endTurn' }).state;
    swapActiveTo(s, 0, ROARING_MOON);
    s.players[0].deck.push(...s.players[0].hand.splice(0)); // nothing to play first: the attack is the choice
    for (let i = 0; i < 3; i++) attachFromDeck(s, 0, DARK);
    s.players[1].deck.push(...s.players[1].hand.splice(0));
    swapActiveTo(s, 1, BIG);
    benchFromHand(s, 1, giveCard(s, 1, BASIC));
    return s;
  }
}

describe('Frenzied Gouging', () => {
  test('the smart bot uses it against a Defending Pokémon that Calamity Storm cannot Knock Out', () => {
    const s = setup();
    const legal = engine.getLegalActions(s, 0);
    const action = bot(engine.viewFor(s, 0), legal, 5).action;
    expect(action).toEqual({ type: 'attack', attackIndex: 0 });
  });

  test('it prefers Calamity Storm when that Knocks Out too, instead of Knocking Out its own Roaring Moon ex', () => {
    const s = setup();
    s.players[0].active!.damage = 30;
    swapActiveTo(s, 1, BASIC); // 110 HP
    s.players[1].active!.damage = 60; // 50 left: Calamity Storm's 100 is enough
    const action = bot(engine.viewFor(s, 0), engine.getLegalActions(s, 0), 5).action;
    expect(action).toEqual({ type: 'attack', attackIndex: 1 });
  });
});
