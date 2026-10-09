import { describe, expect, test } from 'vitest';
import type { DeckList, GameState } from '@ptcg/engine';
import { GYM_DECKS } from '../src/gym.ts';
import { isPlayable } from '../src/playable.ts';
import {
  ID,
  act,
  answer,
  attachFromDeck,
  benchFromHand,
  engine,
  game,
  giveCard,
  registry,
  sv,
  swapActiveTo,
} from './helpers.ts';

const PIKACHU = sv('025');
const RAICHU = sv('026');
const VOLTORB = sv('100');
const ELECTRODE = sv('101');
const MAGNEMITE = sv('081');
const MAGNETON = sv('082');
const L = 'mee-004';
/** One symmetric deck for both seats, since the first player's seat varies. */
const ALL = {
  [PIKACHU]: 4,
  [RAICHU]: 4,
  [VOLTORB]: 4,
  [ELECTRODE]: 4,
  [MAGNEMITE]: 4,
  [MAGNETON]: 4,
  [ID.airBalloon]: 4,
  [ID.ultraBall]: 4,
  [ID.cresselia]: 4,
  [L]: 20,
};
const attack = (s: GameState, i = 0) => act(engine, s, { type: 'attack', attackIndex: i });
const energize = (s: GameState, p: 0 | 1, n: number) => {
  for (let i = 0; i < n; i++) attachFromDeck(s, p, L);
};
/** A tanky opposing Active so damage numbers stay readable. */
const buffer = (s: GameState, opp: 0 | 1) => {
  swapActiveTo(s, opp, ID.cresselia);
  s.players[opp].active!.damage = -400;
};

describe('Surge deck', () => {
  test('60 playable cards', () => {
    const deck = GYM_DECKS.surge as DeckList;
    expect(deck.cards.reduce((n, c) => n + c.count, 0)).toBe(60);
    for (const c of deck.cards) expect(isPlayable(registry.defs[c.id]!, registry), c.id).toBe(true);
  });
});

describe('Pikachu', () => {
  test('Charge attaches a Basic {L} Energy from the deck to itself', () => {
    const { s: s0, me } = game(ALL, ALL);
    swapActiveTo(s0, me, PIKACHU);
    energize(s0, me, 1);
    const before = s0.players[me].active!.energy.length;
    let s = attack(s0, 0);
    if (s.prompt) s = answer(s, s.prompt.options[0]!.id);
    if (s.prompt) s = answer(s, 'done');
    expect(s.players[me].active!.energy.length).toBe(before + 1);
  });
});

describe('Raichu', () => {
  test('Thunder does 180 and 50 to itself', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, RAICHU);
    buffer(s0, opp);
    energize(s0, me, 3);
    const s = attack(s0, 0);
    expect(s.players[opp].active!.damage).toBe(-400 + 180);
    expect(s.players[me].active!.damage).toBe(50);
  });

  test('Electrical Grounding moves a {L} Energy from a Pokémon Knocked Out by an attack, if you choose to', () => {
    for (const accept of [true, false]) {
      const { s: s0, me, opp } = game(ALL, ALL);
      // The opponent attacks; their Raichu is on the Bench, their Active has {L} Energy and is about to be Knocked Out.
      swapActiveTo(s0, me, VOLTORB);
      energize(s0, me, 1);
      swapActiveTo(s0, opp, PIKACHU);
      energize(s0, opp, 1);
      benchFromHand(s0, opp, giveCard(s0, opp, RAICHU));
      s0.players[opp].active!.damage = 50;
      let s = attack(s0, 0);
      expect(s.prompt?.player).toBe(opp);
      const raichu = s.players[opp].bench[0]!;
      const energyBefore = raichu.energy.length;
      s = answer(s, accept ? s.prompt!.options[0]!.id : 'done');
      if (s.prompt?.min === 0 && s.prompt.selected.length === 0 && accept) s = answer(s, 'done');
      const after = [s.players[opp].active, ...s.players[opp].bench].find(
        (b) => b && registry.defs[s.cards[b.stack.at(-1)!]!.defId]!.name === 'Raichu',
      );
      expect(after!.energy.length).toBe(energyBefore + (accept ? 1 : 0));
    }
  });
});

describe('Voltorb', () => {
  test('Tumbling Attack does 10, or 30 on heads', () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 20; seed++) {
      const { s: s0, me, opp } = game(ALL, ALL, { seed });
      swapActiveTo(s0, me, VOLTORB);
      buffer(s0, opp);
      energize(s0, me, 1);
      const s = attack(s0, 0);
      const heads = s.log.slice(s0.log.length).some((l) => l.text === 'Coin flip: heads');
      expect(s.players[opp].active!.damage + 400).toBe(heads ? 30 : 10);
      seen.add(heads ? 30 : 10);
    }
    expect(seen.size).toBe(2);
  });
});

describe('Electrode', () => {
  test('Bang Boom Chain does 20, and 40 more for each Tool discarded (only the picks)', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, ELECTRODE);
    buffer(s0, opp);
    energize(s0, me, 1);
    benchFromHand(s0, me, giveCard(s0, me, VOLTORB));
    const tool = (ref: { stack: string[]; tool: string | null }) => {
      const uid = giveCard(s0, me, ID.airBalloon);
      s0.players[me].hand.splice(s0.players[me].hand.indexOf(uid), 1);
      ref.tool = uid;
      return uid;
    };
    const t1 = tool(s0.players[me].active!);
    const t2 = tool(s0.players[me].bench[0]!);
    let s = attack(s0, 0);
    expect(s.prompt).not.toBeNull();
    s = answer(s, t1);
    s = answer(s, 'done');
    expect(s.players[opp].active!.damage).toBe(-400 + 60);
    expect(s.players[me].active!.tool).toBeNull();
    expect(s.players[me].bench[0]!.tool).toBe(t2);
    expect(s.players[me].discard).toContain(t1);
  });

  test('with no Tools it just does 20', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, ELECTRODE);
    buffer(s0, opp);
    energize(s0, me, 1);
    const s = attack(s0, 0);
    expect(s.prompt).toBeNull();
    expect(s.players[opp].active!.damage).toBe(-400 + 20);
  });
});

describe('Magnemite', () => {
  test('Big Explosion does 60 and 60 to itself (Magnemite has 60 HP, so it Knocks itself Out)', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, MAGNEMITE);
    buffer(s0, opp);
    energize(s0, me, 2);
    const s = attack(s0, 1);
    expect(s.players[opp].active!.damage).toBe(-400 + 60);
    expect(s.players[me].discard.some((u) => s.cards[u]!.defId === MAGNEMITE)).toBe(true);
  });
});

describe('Magneton', () => {
  test('Junk Magnet puts up to 2 Items from the discard pile into your hand', () => {
    const { s: s0, me } = game(ALL, ALL);
    swapActiveTo(s0, me, MAGNETON);
    energize(s0, me, 1);
    const p = s0.players[me];
    for (const defId of [ID.ultraBall, ID.ultraBall, ID.ultraBall, ID.airBalloon]) {
      const uid = giveCard(s0, me, defId);
      p.hand.splice(p.hand.indexOf(uid), 1);
      p.discard.push(uid);
    }
    const handBefore = p.hand.length;
    let s = attack(s0, 0);
    const opts = s.prompt!.options.filter((o) => s.cards[o.uid!]!.defId === ID.ultraBall);
    s = answer(s, opts[0]!.id);
    s = answer(s, opts[1]!.id);
    if (s.prompt) s = answer(s, 'done');
    expect(s.players[me].hand.length).toBe(handBefore + 2);
  });
});
