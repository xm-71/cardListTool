import { describe, expect, test } from 'vitest';
import type { DeckList, GameState, PlayerId } from '@ptcg/engine';
import { isPlayable } from '../src/playable.ts';
import charizard from '../src/decks/mega-charizard-x.json';
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
  [ID.charmander]: 4,
  [ID.charmeleon]: 2,
  [ID.megaCharizardX]: 4,
  [ID.oricorio]: 2,
  [ID.moltres]: 2,
  [ID.volcanion]: 2,
  [ID.chiYu]: 2,
  [ID.mysteryGarden]: 2,
  [ID.fire]: 30,
};
const attack = (s: GameState, i = 0) => act(engine, s, { type: 'attack', attackIndex: i });
const handFire = (s: GameState, p: PlayerId) =>
  s.players[p].hand.filter((u) => s.cards[u]!.defId === ID.fire);

describe('Charmander', () => {
  test('Agile: no Retreat Cost without Energy; the printed 2 with Energy', () => {
    const { s: s0, me } = game(spec);
    swapActiveTo(s0, me, ID.charmander);
    benchFromHand(s0, me, giveCard(s0, me, ID.moltres));
    expect(has(engine.getLegalActions(s0, me), 'retreat')).toBe(true);
    attachFromDeck(s0, me, ID.fire);
    expect(has(engine.getLegalActions(s0, me), 'retreat')).toBe(false);
  });
});

describe('Mega Charizard X ex', () => {
  test('Inferno X discards the chosen {R} Energy from your Pokémon and does 90 for each', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, ID.megaCharizardX);
    attachFromDeck(s0, me, ID.fire);
    attachFromDeck(s0, me, ID.fire);
    benchFromHand(s0, me, giveCard(s0, me, ID.oricorio));
    attachFromDeck(s0, me, ID.fire, 0);
    swapActiveTo(s0, opp, ID.megaCharizardX);
    const s = resolvePrompts(attack(s0));
    expect(s.players[opp].active!.damage).toBe(270);
    expect(s.players[me].active!.energy).toHaveLength(0);
    expect(s.players[me].bench[0]!.energy).toHaveLength(0);
  });

  test('Inferno X discarding nothing does no damage', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, ID.megaCharizardX);
    attachFromDeck(s0, me, ID.fire);
    attachFromDeck(s0, me, ID.fire);
    swapActiveTo(s0, opp, ID.megaCharizardX);
    const s = act(engine, attack(s0), { type: 'answer', optionId: 'done' });
    expect(s.players[opp].active!.damage).toBe(0);
    expect(s.players[me].active!.energy).toHaveLength(2);
  });
});

describe('Oricorio ex', () => {
  const turbo = (me: PlayerId) =>
    ({ type: 'useAbility', slot: { player: me, zone: 'active' }, ability: 'Excited Turbo' }) as const;

  test('Excited Turbo needs a {R} Mega Evolution Pokémon ex in play', () => {
    const { s, me } = game(spec);
    swapActiveTo(s, me, ID.oricorio);
    benchFromHand(s, me, giveCard(s, me, ID.charmander));
    giveCard(s, me, ID.fire);
    expect(engine.getLegalActions(s, me)).not.toContainEqual(turbo(me));
  });

  test('Excited Turbo attaches Basic {R} Energy from hand to Benched {R} Pokémon, as often as you like', () => {
    const { s: s0, me } = game(spec);
    swapActiveTo(s0, me, ID.oricorio);
    benchFromHand(s0, me, giveCard(s0, me, ID.charmander));
    s0.players[me].bench[0]!.stack.push(giveCard(s0, me, ID.megaCharizardX));
    s0.players[me].hand.splice(s0.players[me].hand.indexOf(s0.players[me].bench[0]!.stack[1]!), 1);
    giveCard(s0, me, ID.fire);
    giveCard(s0, me, ID.fire);
    const fireInHand = handFire(s0, me).length;
    let s = resolvePrompts(act(engine, s0, turbo(me)));
    s = resolvePrompts(act(engine, s, turbo(me)));
    expect(s.players[me].bench[0]!.energy).toHaveLength(2);
    expect(handFire(s, me)).toHaveLength(fireInHand - 2);
  });
});

describe('Moltres', () => {
  test('Fighting Wings does 20, or 110 against a Pokémon ex', () => {
    const run = (target: string) => {
      const { s: s0, me, opp } = game(spec);
      swapActiveTo(s0, me, ID.moltres);
      attachFromDeck(s0, me, ID.fire);
      swapActiveTo(s0, opp, target);
      return attack(s0).players[opp].active!.damage;
    };
    expect(run(ID.volcanion)).toBe(20);
    expect(run(ID.oricorio)).toBe(110);
  });
});

describe('Volcanion', () => {
  test('Singe Burns the opponent’s Active Pokémon', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, ID.volcanion);
    attachFromDeck(s0, me, ID.fire);
    const s = attack(s0);
    // Pokémon Checkup between turns puts the Burn damage on it (and may then cure it).
    expect(s.log.some((e) => e.text.endsWith('is now Burned'))).toBe(true);
    expect(s.players[opp].active!.damage).toBe(20);
  });

  test('Backfire does 130 and puts 2 {R} Energy from Volcanion into your hand', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, ID.volcanion);
    for (let i = 0; i < 3; i++) attachFromDeck(s0, me, ID.fire);
    swapActiveTo(s0, opp, ID.megaCharizardX);
    const before = handFire(s0, me).length;
    const s = resolvePrompts(attack(s0, 1));
    expect(s.players[opp].active!.damage).toBe(130);
    expect(s.players[me].active!.energy).toHaveLength(1);
    expect(handFire(s, me)).toHaveLength(before + 2);
  });
});

describe('Chi-Yu', () => {
  const withStadium = (owner: 'me' | 'opp') => {
    const g = game(spec);
    const who = owner === 'me' ? g.me : g.opp;
    const uid = giveCard(g.s, who, ID.mysteryGarden);
    g.s.players[who].hand.splice(g.s.players[who].hand.indexOf(uid), 1);
    g.s.stadium = { uid, owner: who };
    swapActiveTo(g.s, g.me, ID.chiYu);
    attachFromDeck(g.s, g.me, ID.fire);
    return g;
  };

  test('Scorching Earth discards the opponent’s Stadium and blocks their Stadiums next turn', () => {
    const { s: s0, opp } = withStadium('opp');
    const s = attack(s0);
    expect(s.stadium).toBeNull();
    expect(s.players[opp].active!.damage).toBe(40);
    giveCard(s, opp, ID.mysteryGarden);
    const stadiumPlays = engine
      .getLegalActions(s, opp)
      .filter((a) => a.type === 'playTrainer' && s.cards[a.uid]!.defId === ID.mysteryGarden);
    expect(stadiumPlays).toEqual([]);
  });

  test('Scorching Earth leaves your own Stadium alone', () => {
    const { s: s0 } = withStadium('me');
    expect(attack(s0).stadium).not.toBeNull();
  });
});

test('Mega Charizard X ex theme deck: 60 cards, all exist and are playable', () => {
  const deck = charizard as DeckList;
  expect(deck.cards.reduce((n, c) => n + c.count, 0)).toBe(60);
  for (const c of deck.cards) {
    expect(registry.defs[c.id], c.id).toBeDefined();
    expect(isPlayable(registry.defs[c.id]!, registry), c.id).toBe(true);
  }
});
