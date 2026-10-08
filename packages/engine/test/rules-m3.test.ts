import { describe, expect, test } from 'vitest';
import type { CardDef, CardScript } from '../src/cards.ts';
import { createEngine } from '../src/engine.ts';
import {
  ITEM,
  act,
  attachFromDeck,
  benchFromHand,
  deckOf,
  giveCard,
  has,
  miniRegistry,
  pokemon,
  started,
  swapActiveTo,
} from './fixtures.ts';

const stadium = (id: string, name: string): CardDef => ({
  ...(ITEM as Extract<CardDef, { category: 'Trainer' }>),
  id,
  name,
  trainerType: 'Stadium',
});

describe('Stadiums', () => {
  test('only one Stadium can be played per turn, even with a different name', () => {
    const engine = createEngine(miniRegistry([stadium('arena', 'Arena'), stadium('park', 'Park')]));
    let s = started(engine, { 't-basic': 20, 't-dark': 32, arena: 4, park: 4 });
    s = act(engine, s, { type: 'endTurn' });
    const me = s.current;
    const a = giveCard(s, me, 'arena');
    const p = giveCard(s, me, 'park');
    s = act(engine, s, { type: 'playTrainer', uid: a });
    expect(engine.getLegalActions(s, me)).not.toContainEqual({ type: 'playTrainer', uid: p });
    s = act(engine, s, { type: 'endTurn' });
    s = act(engine, s, { type: 'endTurn' });
    expect(engine.getLegalActions(s, me)).toContainEqual({ type: 'playTrainer', uid: p });
  });
});

describe('Knockouts during Pokémon Checkup', () => {
  test('are not "by an attack", even right after an ex attacked', () => {
    const exNoDamage = pokemon('ex0', {
      hp: 200,
      isEx: true,
      attacks: [{ name: 'Glare', cost: ['Colorless'], damage: 0, damageSuffix: '', text: '' }],
    });
    const victim = pokemon('victim', { hp: 200 });
    const scripts: Record<string, CardScript> = {
      victim: {
        modifyPrizes: (q) =>
          q.byAttackFromEx && q.holderSide === q.knockedOut.player ? q.prizes - 1 : q.prizes,
      },
    };
    const engine = createEngine(miniRegistry([exNoDamage, victim], scripts));
    const deck = { 't-basic': 20, ex0: 4, victim: 4, 't-dark': 32 };
    let s = started(engine, deck, deck, 2);
    s = act(engine, s, { type: 'endTurn' });
    const me = s.current;
    const opp = me === 0 ? 1 : 0;
    swapActiveTo(s, me, 'ex0');
    attachFromDeck(s, me, 't-dark');
    swapActiveTo(s, opp, 'victim');
    s.players[opp].active!.damage = 190;
    s.players[opp].active!.conditions.poisoned = true;
    benchFromHand(s, opp, giveCard(s, opp, 't-basic'));
    s = act(engine, s, { type: 'attack', attackIndex: 0 });
    expect(s.players[opp].active!.stack[0]).not.toBe(undefined);
    expect(6 - s.players[me].prizes.length).toBe(1);
  });
});

describe('action matching', () => {
  test('an action with its keys in a different order is still accepted', () => {
    const engine = createEngine(miniRegistry());
    const s = started(engine);
    const me = s.current;
    const e = giveCard(s, me, 't-dark');
    const reordered = JSON.parse(
      `{"target":{"zone":"active","player":${me}},"uid":"${e}","type":"attachEnergy"}`,
    );
    expect(() => engine.applyAction(s, me, reordered)).not.toThrow();
  });
});

describe('concede', () => {
  test('either player can concede at any time before the game ends, including during a prompt', () => {
    const engine = createEngine(miniRegistry());
    const s = engine.createGame({
      decks: [deckOf({ 't-basic': 20, 't-dark': 40 }), deckOf({ 't-basic': 20, 't-dark': 40 })],
      seed: 1,
    });
    expect(s.prompt).not.toBeNull();
    for (const p of [0, 1] as const) expect(has(engine.getLegalActions(s, p), 'concede')).toBe(true);
    const done = act(engine, s, { type: 'concede' }, s.prompt!.player === 0 ? 1 : 0);
    expect(done.result?.reason).toBe('concede');
    expect(engine.getLegalActions(done, 0)).toEqual([]);
  });
});

describe('mulligans', () => {
  test('bonus cards are only for the difference in mulligans', () => {
    const engine = createEngine(miniRegistry());
    const thin = deckOf({ 't-basic': 1, 't-dark': 59 });
    for (let seed = 1; seed < 400; seed++) {
      const s = engine.createGame({ decks: [thin, thin], seed });
      const [m0, m1] = [s.players[0].mulligans, s.players[1].mulligans];
      if (!(m0 > 0 && m1 > 0 && m0 !== m1)) continue;
      // with one Basic each, setup is automatic: hand = 7 + bonus − 1 Active (+1 draw for the first player)
      for (const p of [0, 1] as const) {
        const bonus = Math.max(0, (p === 0 ? m1 : m0) - (p === 0 ? m0 : m1));
        expect(s.players[p].hand).toHaveLength(7 + bonus - 1 + (p === s.first ? 1 : 0));
      }
      return;
    }
    throw new Error('no seed with unequal double mulligans');
  });
});
