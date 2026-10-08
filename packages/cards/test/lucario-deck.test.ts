import { describe, expect, test } from 'vitest';
import type { GameState, PlayerId } from '@ptcg/engine';
import {
  ID,
  act,
  answer,
  attachFromDeck,
  benchFromHand,
  engine,
  game,
  giveCard,
  has,
  playTrainer,
  resolvePrompts,
  swapActiveTo,
} from './helpers.ts';

const deckSpec = {
  [ID.riolu]: 4,
  [ID.megaLucario]: 4,
  [ID.makuhita]: 4,
  [ID.hariyama]: 2,
  [ID.solrock]: 3,
  [ID.lunatone]: 3,
  [ID.fezandipiti]: 1,
  [ID.ursaluna]: 1,
  [ID.megaGengar]: 2,
  [ID.gastly]: 4,
  [ID.switch]: 4,
  [ID.fighting]: 28,
};
const attackActions = (s: GameState, p: PlayerId) =>
  engine.getLegalActions(s, p).filter((a) => a.type === 'attack');
const discardEnergy = (s: GameState, p: PlayerId, n: number) => {
  for (let i = 0; i < n; i++) {
    const e = giveCard(s, p, ID.fighting);
    s.players[p].hand.splice(s.players[p].hand.indexOf(e), 1);
    s.players[p].discard.push(e);
  }
};

describe('Mega Lucario ex', () => {
  test('Aura Jab attaches up to 3 Basic {F} Energy from the discard pile to Benched Pokémon', () => {
    const { s: s0, me } = game(deckSpec);
    swapActiveTo(s0, me, ID.megaLucario);
    attachFromDeck(s0, me, ID.fighting);
    benchFromHand(s0, me, giveCard(s0, me, ID.riolu));
    benchFromHand(s0, me, giveCard(s0, me, ID.solrock));
    discardEnergy(s0, me, 3);
    const s = resolvePrompts(act(engine, s0, { type: 'attack', attackIndex: 0 }));
    const benchEnergy = s.players[me].bench.reduce((n, b) => n + b.energy.length, 0);
    expect(benchEnergy).toBe(3);
  });

  test('Mega Brave can’t be used next turn, but can again after the Pokémon left the Active Spot', () => {
    const { s: s0, me, opp } = game(deckSpec);
    swapActiveTo(s0, me, ID.megaLucario);
    attachFromDeck(s0, me, ID.fighting);
    attachFromDeck(s0, me, ID.fighting);
    benchFromHand(s0, me, giveCard(s0, me, ID.solrock));
    swapActiveTo(s0, opp, ID.megaLucario); // 340 HP, survives 270
    let s = act(engine, s0, { type: 'attack', attackIndex: 1 });
    s = resolvePrompts(s);
    s = act(engine, s, { type: 'endTurn' });
    expect(attackActions(s, me)).toEqual([{ type: 'attack', attackIndex: 0 }]);
    s = resolvePrompts(act(engine, s, playTrainer(giveCard(s, me, ID.switch))));
    s = resolvePrompts(act(engine, s, playTrainer(giveCard(s, me, ID.switch))));
    expect(s.cards[s.players[me].active!.stack.at(-1)!]!.defId).toBe(ID.megaLucario);
    expect(attackActions(s, me)).toContainEqual({ type: 'attack', attackIndex: 1 });
  });
});

describe('Riolu', () => {
  test('Accelerating Stab can’t be used two turns in a row', () => {
    const { s: s0, me } = game(deckSpec);
    swapActiveTo(s0, me, ID.riolu);
    attachFromDeck(s0, me, ID.fighting);
    let s = act(engine, s0, { type: 'attack', attackIndex: 0 });
    s = resolvePrompts(s);
    s = act(engine, s, { type: 'endTurn' });
    expect(has(engine.getLegalActions(s, me), 'attack')).toBe(false);
  });
});

describe('Hariyama', () => {
  test('Heave-Ho Catcher may switch in one of the opponent’s Benched Pokémon when evolving from hand', () => {
    const { s: s0, me, opp } = game(deckSpec, undefined, { turn: 3 });
    swapActiveTo(s0, me, ID.makuhita);
    benchFromHand(s0, opp, giveCard(s0, opp, ID.lunatone));
    const target = s0.players[opp].bench[0]!.stack[0];
    let s = act(engine, s0, {
      type: 'evolve',
      uid: giveCard(s0, me, ID.hariyama),
      target: { player: me, zone: 'active' },
    });
    s = answer(s, 'yes');
    s = resolvePrompts(s);
    expect(s.players[opp].active!.stack[0]).toBe(target);
  });

  test('Wild Press does 210 and 70 to itself', () => {
    const { s: s0, me, opp } = game(deckSpec);
    swapActiveTo(s0, me, ID.hariyama);
    for (let i = 0; i < 3; i++) attachFromDeck(s0, me, ID.fighting);
    swapActiveTo(s0, opp, ID.megaLucario); // no Fighting Weakness
    const s = act(engine, s0, { type: 'attack', attackIndex: 0 });
    expect(s.players[opp].active!.damage).toBe(210);
    expect(s.players[me].active!.damage).toBe(70);
  });
});

describe('Solrock', () => {
  test('Cosmic Beam does 70 ignoring Weakness only with Lunatone on the Bench', () => {
    const run = (withLunatone: boolean) => {
      const { s: s0, me, opp } = game(deckSpec);
      swapActiveTo(s0, me, ID.solrock);
      attachFromDeck(s0, me, ID.fighting);
      if (withLunatone) benchFromHand(s0, me, giveCard(s0, me, ID.lunatone));
      swapActiveTo(s0, opp, ID.megaGengar); // weak to Fighting
      return act(engine, s0, { type: 'attack', attackIndex: 0 }).players[opp].active!.damage;
    };
    expect(run(true)).toBe(70);
    expect(run(false)).toBe(0);
  });
});

describe('Lunatone', () => {
  test('Lunar Cycle discards a Basic {F} Energy to draw 3, once per turn across all Lunatone', () => {
    const { s: s0, me } = game(deckSpec);
    swapActiveTo(s0, me, ID.lunatone);
    benchFromHand(s0, me, giveCard(s0, me, ID.lunatone));
    benchFromHand(s0, me, giveCard(s0, me, ID.solrock));
    giveCard(s0, me, ID.fighting);
    giveCard(s0, me, ID.fighting);
    const use = { type: 'useAbility', slot: { player: me, zone: 'active' }, ability: 'Lunar Cycle' } as const;
    const hand = s0.players[me].hand.length;
    let s = act(engine, s0, use);
    s = resolvePrompts(s);
    expect(s.players[me].hand).toHaveLength(hand - 1 + 3);
    expect(
      engine.getLegalActions(s, me).some((a) => a.type === 'useAbility' && a.ability === 'Lunar Cycle'),
    ).toBe(false);
  });

  test('needs Solrock in play', () => {
    const { s, me } = game(deckSpec);
    swapActiveTo(s, me, ID.lunatone);
    giveCard(s, me, ID.fighting);
    expect(engine.getLegalActions(s, me).some((a) => a.type === 'useAbility')).toBe(false);
  });
});

describe('Fezandipiti ex', () => {
  test('Flip the Script draws 3 only after one of your Pokémon was Knocked Out last turn', () => {
    const { s, me } = game(deckSpec);
    swapActiveTo(s, me, ID.fezandipiti);
    const flip = {
      type: 'useAbility',
      slot: { player: me, zone: 'active' },
      ability: 'Flip the Script',
    } as const;
    expect(engine.getLegalActions(s, me)).not.toContainEqual(flip);
    s.players[me].lastKnockedOutTurn = s.turn - 1;
    const hand = s.players[me].hand.length;
    const after = act(engine, s, flip);
    expect(after.players[me].hand).toHaveLength(hand + 3);
  });

  test('Cruel Arrow does 100 to a chosen Benched Pokémon without Weakness', () => {
    const { s: s0, me, opp } = game(deckSpec);
    swapActiveTo(s0, me, ID.fezandipiti);
    for (let i = 0; i < 3; i++) attachFromDeck(s0, me, ID.fighting);
    benchFromHand(s0, opp, giveCard(s0, opp, ID.megaGengar)); // weak to Fighting — must not matter on the Bench
    let s = act(engine, s0, { type: 'attack', attackIndex: 0 });
    const benchOption = s.prompt!.options.find((o) => o.slot?.zone === 'bench')!;
    s = answer(s, benchOption.id);
    expect(s.players[opp].bench[0]!.damage).toBe(100);
  });
});

describe('Bloodmoon Ursaluna ex', () => {
  test('Blood Moon costs one less for each Prize the opponent has taken, and locks attacking next turn', () => {
    const { s: s0, me, opp } = game(deckSpec);
    swapActiveTo(s0, me, ID.ursaluna);
    for (let i = 0; i < 3; i++) attachFromDeck(s0, me, ID.fighting);
    expect(has(engine.getLegalActions(s0, me), 'attack')).toBe(false); // needs 5 with 0 Prizes taken
    s0.players[opp].deck.push(...s0.players[opp].prizes.splice(0, 2)); // opponent has taken 2
    expect(engine.getLegalActions(s0, me)).toContainEqual({ type: 'attack', attackIndex: 0 });
    swapActiveTo(s0, opp, ID.megaGengar);
    let s = act(engine, s0, { type: 'attack', attackIndex: 0 });
    expect(s.players[opp].active!.damage).toBe(240);
    s = act(engine, s, { type: 'endTurn' });
    expect(has(engine.getLegalActions(s, me), 'attack')).toBe(false);
  });
});
