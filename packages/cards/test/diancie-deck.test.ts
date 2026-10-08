import { describe, expect, test } from 'vitest';
import { createEngine, type CardDef, type GameState, type PlayerId } from '@ptcg/engine';
import { pokemon, started } from '@ptcg/engine/testing';
import {
  ID,
  act,
  answer,
  answerCards,
  attachFromDeck,
  benchFromHand,
  deck,
  engine,
  game,
  giveCard,
  registry,
  resolvePrompts,
  swapActiveTo,
} from './helpers.ts';

const psyDeck = {
  [ID.megaDiancie]: 4,
  [ID.meloetta]: 4,
  [ID.spoink]: 4,
  [ID.grumpig]: 4,
  [ID.milcery]: 4,
  [ID.alcremie]: 4,
  [ID.mimikyu]: 4,
  [ID.cresselia]: 4,
  [ID.zacian]: 4,
  [ID.psychic]: 24,
};

const flips = (s: GameState, from: number) =>
  s.log
    .slice(from)
    .filter((e) => e.type === 'coinFlip')
    .map((e) => e.text.endsWith('heads'));

function setup(attacker: string, energy: number, defender = ID.megaDiancie) {
  const { s, me, opp } = game(psyDeck);
  swapActiveTo(s, me, attacker);
  swapActiveTo(s, opp, defender);
  for (let i = 0; i < energy; i++) attachFromDeck(s, me, ID.psychic);
  return { s, me, opp };
}

describe('Mega Diancie ex', () => {
  test('Garland Ray does 120 for each Energy discarded from it (0, 1 or 2)', () => {
    const run = (discard: number) => {
      const { s: s0, me, opp } = setup(ID.megaDiancie, 2, ID.zacian);
      s0.players[opp].active!.damage = 0;
      let s = act(engine, s0, { type: 'attack', attackIndex: 0 });
      const opts = s.prompt!.options.map((o) => o.id);
      if (discard === 0) s = answer(s, 'done');
      for (let i = 0; i < discard; i++) {
        s = answer(s, opts[i]!);
        if (discard === 1) s = answer(s, 'done');
      }
      return {
        dealt: s.players[opp].active?.damage ?? 'KO',
        energyLeft: s.players[me].active!.energy.length,
      };
    };
    expect(run(0)).toEqual({ dealt: 0, energyLeft: 2 });
    expect(run(1)).toEqual({ dealt: 120, energyLeft: 1 });
  });

  test('Garland Ray discarding 2 does 240', () => {
    const { s: s0, opp } = setup(ID.megaDiancie, 2, ID.megaDiancie);
    let s = act(engine, s0, { type: 'attack', attackIndex: 0 });
    const opts = s.prompt!.options.map((o) => o.id);
    s = answer(answer(s, opts[0]!), opts[1]!);
    expect(s.players[opp].active!.damage).toBe(240 - 30); // Diamond Coat on the defender
  });

  test('Diamond Coat: takes 30 less damage after Weakness', () => {
    const metal: CardDef = pokemon('metal-test', { types: ['Metal'], hp: 100 });
    const custom = createEngine({ defs: { ...registry.defs, [metal.id]: metal }, scripts: registry.scripts });
    let s = started(
      custom,
      deck({ 'metal-test': 10, [ID.megaDiancie]: 4 }),
      deck({ 'metal-test': 10, [ID.megaDiancie]: 4 }),
      3,
    );
    s = custom.applyAction(s, s.current, { type: 'endTurn' }).state;
    const me: PlayerId = s.current;
    const opp: PlayerId = me === 0 ? 1 : 0;
    swapMetal(s, me, opp);
    attachFromDeck(s, me, ID.darkness);
    s = custom.applyAction(s, me, { type: 'attack', attackIndex: 0 }).state;
    expect(s.players[opp].active!.damage).toBe(20 * 2 - 30);
  });
});

/** Make `me` attack with the test Metal Pokémon (Tackle, 20) into Mega Diancie ex. */
function swapMetal(s: GameState, me: PlayerId, opp: PlayerId) {
  swapActiveTo(s, me, 'metal-test');
  swapActiveTo(s, opp, ID.megaDiancie);
}

describe('Meloetta', () => {
  test('Soothing Melody heals 120 from a Benched {P} Pokémon', () => {
    const { s: s0, me } = setup(ID.meloetta, 1);
    benchFromHand(s0, me, giveCard(s0, me, ID.cresselia));
    s0.players[me].bench[0]!.damage = 100;
    const s = resolvePrompts(act(engine, s0, { type: 'attack', attackIndex: 0 }));
    expect(s.players[me].bench[0]!.damage).toBe(0);
  });
});

describe('Spoink', () => {
  test('Triple Spin does 10 for each heads out of 3 flips', () => {
    const { s: s0, opp } = setup(ID.spoink, 1, ID.megaDiancie);
    const from = s0.log.length;
    const s = act(engine, s0, { type: 'attack', attackIndex: 0 });
    const heads = flips(s, from).filter(Boolean).length;
    expect(flips(s, from)).toHaveLength(3);
    expect(s.players[opp].active!.damage).toBe(Math.max(0, heads * 10 - 30));
  });
});

describe('Grumpig', () => {
  test('Energized Steps attaches Basic Energy found in the top 4 cards and shuffles the rest back', () => {
    const { s: s0, me } = game(psyDeck, undefined, { turn: 3 });
    const spoink = giveCard(s0, me, ID.spoink);
    benchFromHand(s0, me, spoink);
    const p = s0.players[me];
    // top of deck: Energy, Zacian, Energy, Zacian
    const e1 = giveCard(s0, me, ID.psychic);
    const z1 = giveCard(s0, me, ID.zacian);
    const e2 = giveCard(s0, me, ID.psychic);
    const z2 = giveCard(s0, me, ID.zacian);
    for (const u of [e1, z1, e2, z2]) p.hand.splice(p.hand.indexOf(u), 1);
    p.deck.unshift(e1, z1, e2, z2);
    const grumpig = giveCard(s0, me, ID.grumpig);
    const deckSize = p.deck.length;
    let s = act(engine, s0, {
      type: 'evolve',
      uid: grumpig,
      target: { player: me, zone: 'bench', index: 0 },
    });
    s = answer(s, 'yes');
    s = resolvePrompts(s); // pick each Energy, attach to the first offered Pokémon
    const attached = [s.players[me].active!, ...s.players[me].bench].flatMap((sl) => sl.energy);
    expect(attached).toEqual(expect.arrayContaining([e1, e2]));
    expect(s.players[me].deck).toHaveLength(deckSize - 2);
    expect(s.players[me].deck).toEqual(expect.arrayContaining([z1, z2]));
  });

  test('Energized Steps is optional', () => {
    const { s: s0, me } = game(psyDeck, undefined, { turn: 3 });
    benchFromHand(s0, me, giveCard(s0, me, ID.spoink));
    const grumpig = giveCard(s0, me, ID.grumpig);
    const deckBefore = [...s0.players[me].deck];
    let s = act(engine, s0, {
      type: 'evolve',
      uid: grumpig,
      target: { player: me, zone: 'bench', index: 0 },
    });
    s = answer(s, 'no');
    expect(s.prompt).toBeNull();
    expect(s.players[me].deck).toEqual(deckBefore);
  });
});

describe('Milcery', () => {
  test('Draining Kiss heals 10 from itself', () => {
    const { s: s0, me } = setup(ID.milcery, 1);
    s0.players[me].active!.damage = 30;
    const s = act(engine, s0, { type: 'attack', attackIndex: 0 });
    expect(s.players[me].active!.damage).toBe(20);
  });
});

describe('Alcremie', () => {
  test('Sweet Circle does 20 for each of your Pokémon in play', () => {
    const { s: s0, me, opp } = setup(ID.alcremie, 1, ID.zacian);
    for (let i = 0; i < 3; i++) benchFromHand(s0, me, giveCard(s0, me, ID.spoink));
    const s = act(engine, s0, { type: 'attack', attackIndex: 0 });
    expect(s.players[opp].active!.damage).toBe(80);
  });
});

describe('Mimikyu', () => {
  test('Call for Family puts a Basic Pokémon from the deck onto the Bench', () => {
    const { s: s0, me } = setup(ID.mimikyu, 1);
    const s = answerCards(act(engine, s0, { type: 'attack', attackIndex: 0 }), [ID.zacian]);
    expect(s.players[me].bench.map((b) => s.cards[b.stack[0]!]!.defId)).toEqual([ID.zacian]);
  });
});

describe('Cresselia', () => {
  test('Swelling Light attaches up to 2 Basic {P} Energy from the deck to itself', () => {
    const { s: s0, me } = setup(ID.cresselia, 1);
    const s = resolvePrompts(act(engine, s0, { type: 'attack', attackIndex: 0 }));
    expect(s.players[me].active!.energy).toHaveLength(3);
  });
});

describe('Zacian', () => {
  test('Limit Break does 140 if the opponent has 3 or fewer Prizes left, otherwise 50', () => {
    const run = (oppPrizes: number) => {
      // into Mega Diancie ex (Diamond Coat: −30) so the defender survives
      const { s: s0, opp } = setup(ID.zacian, 2, ID.megaDiancie);
      s0.players[opp].deck.push(...s0.players[opp].prizes.splice(oppPrizes));
      return act(engine, s0, { type: 'attack', attackIndex: 0 }).players[opp].active!.damage;
    };
    expect(run(3)).toBe(140 - 30);
    expect(run(4)).toBe(50 - 30);
  });
});
