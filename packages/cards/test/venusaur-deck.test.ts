import { describe, expect, test } from 'vitest';
import type { Action, DeckList, GameState, PlayerId } from '@ptcg/engine';
import { isPlayable } from '../src/playable.ts';
import venusaur from '../src/decks/mega-venusaur.json';
import {
  ID,
  act,
  attachFromDeck,
  benchFromHand,
  engine,
  game,
  giveCard,
  has,
  registry,
  resolvePrompts,
  swapActiveTo,
} from './helpers.ts';

const spec = {
  [ID.bulbasaur]: 4,
  [ID.ivysaur]: 2,
  [ID.megaVenusaur]: 3,
  [ID.exeggcute]: 2,
  [ID.exeggutor]: 3,
  [ID.shuckle]: 2,
  [ID.celebi]: 2,
  [ID.mysteryGarden]: 2,
  [ID.grass]: 30,
};
const attack = (s: GameState, i = 0) => act(engine, s, { type: 'attack', attackIndex: i });
const ability = (p: PlayerId, ability: string): Action => ({
  type: 'useAbility',
  slot: { player: p, zone: 'active' },
  ability,
});

describe('Bulbasaur', () => {
  test('Bind Down: the Defending Pokémon can’t retreat during the opponent’s next turn', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, ID.bulbasaur);
    attachFromDeck(s0, me, ID.grass);
    swapActiveTo(s0, opp, ID.celebi);
    attachFromDeck(s0, opp, ID.grass);
    benchFromHand(s0, opp, giveCard(s0, opp, ID.shuckle));
    const s = attack(s0);
    expect(s.players[opp].active!.damage).toBe(10);
    expect(has(engine.getLegalActions(s, opp), 'retreat')).toBe(false);
  });
});

describe('Mega Venusaur ex', () => {
  test('Solar Transfer moves Basic {G} Energy between your Pokémon, as often as you like', () => {
    const { s: s0, me } = game(spec);
    swapActiveTo(s0, me, ID.megaVenusaur);
    attachFromDeck(s0, me, ID.grass);
    attachFromDeck(s0, me, ID.grass);
    benchFromHand(s0, me, giveCard(s0, me, ID.bulbasaur));
    let s = resolvePrompts(act(engine, s0, ability(me, 'Solar Transfer')));
    s = resolvePrompts(act(engine, s, ability(me, 'Solar Transfer')));
    expect(s.players[me].active!.energy).toHaveLength(0);
    expect(s.players[me].bench[0]!.energy).toHaveLength(2);
  });

  test('Solar Transfer needs Energy to move and another Pokémon to move it to', () => {
    const { s, me } = game(spec);
    swapActiveTo(s, me, ID.megaVenusaur);
    attachFromDeck(s, me, ID.grass);
    expect(engine.getLegalActions(s, me)).not.toContainEqual(ability(me, 'Solar Transfer'));
  });

  test('Jungle Dump does 240 and heals 30 from itself', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, ID.megaVenusaur);
    for (let i = 0; i < 4; i++) attachFromDeck(s0, me, ID.grass);
    s0.players[me].active!.damage = 100;
    swapActiveTo(s0, opp, ID.megaVenusaur);
    const s = attack(s0);
    expect(s.players[opp].active!.damage).toBe(240);
    expect(s.players[me].active!.damage).toBe(70);
  });
});

describe('Exeggcute', () => {
  test('Jam-Packed attaches a Basic {G} Energy from the deck to itself', () => {
    const { s: s0, me } = game(spec);
    swapActiveTo(s0, me, ID.exeggcute);
    attachFromDeck(s0, me, ID.grass);
    const s = resolvePrompts(attack(s0));
    expect(s.players[me].active!.energy).toHaveLength(2);
  });
});

describe('Exeggutor', () => {
  test('Guard Press: 30 less damage during the opponent’s next turn', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, ID.exeggutor);
    attachFromDeck(s0, me, ID.grass);
    swapActiveTo(s0, opp, ID.exeggutor);
    for (let i = 0; i < 3; i++) attachFromDeck(s0, opp, ID.grass);
    let s = attack(s0);
    expect(s.players[opp].active!.damage).toBe(30);
    s = attack(s, 1); // Stomping Wood: 60 + 3×30 = 150, minus 30
    expect(s.players[me].active!.damage).toBe(120);
  });

  test('Stomping Wood does 60 plus 30 for each {G} Energy attached', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, ID.exeggutor);
    for (let i = 0; i < 3; i++) attachFromDeck(s0, me, ID.grass);
    swapActiveTo(s0, opp, ID.megaVenusaur);
    expect(attack(s0, 1).players[opp].active!.damage).toBe(150);
  });
});

describe('Shuckle', () => {
  test('Fermented Juice heals 30 from one of your Pokémon, once a turn, with {G} attached', () => {
    const { s: s0, me } = game(spec);
    swapActiveTo(s0, me, ID.shuckle);
    benchFromHand(s0, me, giveCard(s0, me, ID.bulbasaur));
    s0.players[me].bench[0]!.damage = 50;
    expect(engine.getLegalActions(s0, me)).not.toContainEqual(ability(me, 'Fermented Juice'));
    attachFromDeck(s0, me, ID.grass);
    const s = resolvePrompts(act(engine, s0, ability(me, 'Fermented Juice')));
    expect(s.players[me].bench[0]!.damage).toBe(20);
    expect(engine.getLegalActions(s, me)).not.toContainEqual(ability(me, 'Fermented Juice'));
  });
});

describe('Celebi', () => {
  test('Traverse Time puts up to 3 {G} Pokémon and Stadium cards from the deck into your hand', () => {
    const { s: s0, me } = game(spec);
    swapActiveTo(s0, me, ID.celebi);
    attachFromDeck(s0, me, ID.grass);
    const hand = s0.players[me].hand.length;
    const s = resolvePrompts(attack(s0));
    const added = s.players[me].hand.slice(hand).map((u) => registry.defs[s.cards[u]!.defId]!);
    expect(added).toHaveLength(3);
    for (const d of added)
      expect(
        (d.category === 'Pokemon' && d.types.includes('Grass')) ||
          (d.category === 'Trainer' && d.trainerType === 'Stadium'),
      ).toBe(true);
  });
});

test('Mega Venusaur ex theme deck: 60 cards, all exist and are playable', () => {
  const deck = venusaur as DeckList;
  expect(deck.cards.reduce((n, c) => n + c.count, 0)).toBe(60);
  for (const c of deck.cards) {
    expect(registry.defs[c.id], c.id).toBeDefined();
    expect(isPlayable(registry.defs[c.id]!, registry), c.id).toBe(true);
  }
});
