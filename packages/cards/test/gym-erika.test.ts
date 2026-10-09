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
  playTrainer,
  registry,
  resolvePrompts,
  sv,
  swapActiveTo,
} from './helpers.ts';

const ODDISH = sv('043');
const GLOOM = sv('044');
const VILEPLUME = sv('045');
const EXEGGCUTE = sv('102');
const EXEGGUTOR = sv('103');
const TANGELA = sv('114');
const INVITE = sv('160');
const G = 'mee-001';
const ALL = {
  [ODDISH]: 4,
  [GLOOM]: 4,
  [VILEPLUME]: 4,
  [EXEGGCUTE]: 4,
  [EXEGGUTOR]: 4,
  [TANGELA]: 4,
  [INVITE]: 4,
  [ID.cresselia]: 4,
  [G]: 20,
};
const attack = (s: GameState, i = 0) => act(engine, s, { type: 'attack', attackIndex: i });
const buffer = (s: GameState, opp: 0 | 1) => {
  swapActiveTo(s, opp, ID.cresselia);
  s.players[opp].active!.damage = -400;
};

test('Erika deck: 60 playable cards', () => {
  const deck = GYM_DECKS.erika as DeckList;
  expect(deck.cards.reduce((n, c) => n + c.count, 0)).toBe(60);
  for (const c of deck.cards) expect(isPlayable(registry.defs[c.id]!, registry), c.id).toBe(true);
});

describe.each([
  ['Gloom', GLOOM, 3],
  ['Vileplume', VILEPLUME, 8],
])('%s', (_n, evo, look) => {
  test(`attaches Basic Energy from the top ${look} cards one at a time; the rest return to the deck`, () => {
    const { s: s0, me } = game(ALL, ALL, { turn: 3 });
    benchFromHand(s0, me, giveCard(s0, me, evo === GLOOM ? ODDISH : ODDISH));
    const p = s0.players[me];
    if (evo === VILEPLUME) p.bench[0]!.stack.push(giveCard(s0, me, GLOOM)); // Gloom in play (setup)
    if (evo === VILEPLUME) p.hand.splice(p.hand.length - 1, 1);
    const e1 = giveCard(s0, me, G);
    const t1 = giveCard(s0, me, TANGELA);
    const e2 = giveCard(s0, me, G);
    const e3 = giveCard(s0, me, G);
    for (const u of [e1, t1, e2, e3]) p.hand.splice(p.hand.indexOf(u), 1);
    // The third Energy sits just beyond the top 3 cards.
    p.deck.unshift(e3);
    p.deck.unshift(t1);
    p.deck.unshift(e1);
    p.deck.splice(2, 0, e2);
    const top = p.deck.slice(0, look);
    const insideE = [e1, e2, e3].filter((u) => top.includes(u));
    const evoUid = giveCard(s0, me, evo);
    const deckSize = p.deck.length;
    let s = act(engine, s0, { type: 'evolve', uid: evoUid, target: { player: me, zone: 'bench', index: 0 } });
    s = answer(s, 'yes');
    s = resolvePrompts(s);
    const attached = [s.players[me].active!, ...s.players[me].bench].flatMap((sl) => sl.energy);
    for (const e of insideE) expect(attached).toContain(e);
    for (const e of [e1, e2, e3].filter((u) => !top.includes(u))) expect(attached).not.toContain(e);
    expect(s.players[me].deck).toHaveLength(deckSize - insideE.length);
    expect(s.players[me].deck).toContain(t1);
  });
});

describe('Exeggcute', () => {
  test('Ball Roll does 30 per heads before the first tails', () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 25; seed++) {
      const { s: s0, me, opp } = game(ALL, ALL, { seed });
      swapActiveTo(s0, me, EXEGGCUTE);
      buffer(s0, opp);
      attachFromDeck(s0, me, G);
      attachFromDeck(s0, me, G);
      const s = attack(s0, 0);
      const heads = s.log.slice(s0.log.length).filter((l) => l.text === 'Coin flip: heads').length;
      expect(s.players[opp].active!.damage).toBe(-400 + 30 * heads);
      seen.add(heads);
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('Exeggutor', () => {
  test('Psychic does 30 more for each Energy on the Defending Pokémon', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, EXEGGUTOR);
    buffer(s0, opp);
    attachFromDeck(s0, me, G);
    attachFromDeck(s0, me, G);
    attachFromDeck(s0, opp, G);
    attachFromDeck(s0, opp, G);
    const s = attack(s0, 0);
    expect(s.players[opp].active!.damage).toBe(-400 + 30 + 60);
  });
});

describe('Tangela and Erika’s Invitation', () => {
  test('Tactful Tangling does 10, or 70 after Erika’s Invitation this turn', () => {
    const run = (invite: boolean) => {
      const { s: s0, me, opp } = game(ALL, ALL);
      swapActiveTo(s0, me, TANGELA);
      buffer(s0, opp);
      attachFromDeck(s0, me, G);
      let s = s0;
      if (invite) {
        const uid = giveCard(s, me, INVITE);
        s.players[opp].hand.push(giveCard(s, opp, ODDISH));
        s = act(engine, s, playTrainer(uid));
        s = resolvePrompts(s);
        // The invited Pokémon is now their Active; put the buffer back for a readable number.
        s.players[opp].active!.damage = -400;
      }
      s = attack(s, 0);
      return s.players[opp].active!.damage;
    };
    expect(run(false)).toBe(-400 + 10);
    // Oddish (60 HP) with -400 damage survives the 70.
    expect(run(true)).toBe(-400 + 70);
  });

  test('puts a Basic Pokémon the player picks from the opponent’s revealed hand on their Bench and switches it in', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    const uid = giveCard(s0, me, INVITE);
    const oddish = giveCard(s0, opp, ODDISH);
    const tangela = giveCard(s0, opp, TANGELA);
    const oldActive = s0.players[opp].active!.stack[0]!;
    const basicsInHand = s0.players[opp].hand.filter(
      (u) => registry.defs[s0.cards[u]!.defId]!.category === 'Pokemon',
    );
    expect(basicsInHand).toEqual(expect.arrayContaining([oddish, tangela]));
    const s = resolvePrompts(act(engine, s0, playTrainer(uid)));
    const actives = s.players[opp].active!.stack;
    expect(basicsInHand).toContain(actives[0]);
    expect(s.players[opp].bench.some((b) => b.stack[0] === oldActive)).toBe(true);
    expect(s.log.some((l) => l.type === 'reveal')).toBe(true);
  });

  test('cannot be played with no Basic Pokémon in their hand, or a full Bench', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    const uid = giveCard(s0, me, INVITE);
    const o = s0.players[opp];
    o.deck.push(...o.hand.splice(0));
    o.hand.push(giveCard(s0, opp, G));
    expect(() => act(engine, s0, playTrainer(uid))).toThrow();
    const MANY = { [ODDISH]: 30, [INVITE]: 4, [G]: 26 };
    const { s: s1, me: me1, opp: opp1 } = game(MANY, MANY);
    const uid1 = giveCard(s1, me1, INVITE);
    giveCard(s1, opp1, ODDISH);
    while (s1.players[opp1].bench.length < 5) benchFromHand(s1, opp1, giveCard(s1, opp1, ODDISH));
    expect(() => act(engine, s1, playTrainer(uid1))).toThrow();
  });
});
