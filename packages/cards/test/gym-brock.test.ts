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

const GEODUDE = sv('074');
const GRAVELER = sv('075');
const GOLEM = sv('076');
const ONIX = sv('095');
const RHYHORN = sv('111');
const RHYDON = sv('112');
const attack = (s: GameState, i = 0) => act(engine, s, { type: 'attack', attackIndex: i });
const fighting = (s: GameState, p: 0 | 1, n: number) => {
  for (let i = 0; i < n; i++) attachFromDeck(s, p, ID.fighting);
};
/** One symmetric deck for both seats, since the first player's seat varies. */
const ALL = {
  [GEODUDE]: 4,
  [GRAVELER]: 4,
  [GOLEM]: 4,
  [RHYHORN]: 4,
  [RHYDON]: 4,
  [ID.cresselia]: 4,
  [ID.fighting]: 20,
};

describe('Brock deck', () => {
  const deck = GYM_DECKS.brock as DeckList;
  test('60 playable Gym-legal cards', () => {
    expect(deck.cards.reduce((n, c) => n + c.count, 0)).toBe(60);
    for (const c of deck.cards) expect(isPlayable(registry.defs[c.id]!, registry), c.id).toBe(true);
  });
});

describe('Geodude', () => {
  test('Stiffen takes 30 less damage during the opponent’s next turn', () => {
    const { s: s0, me } = game(ALL);
    swapActiveTo(s0, me, GEODUDE);
    fighting(s0, me, 1);
    const s = attack(s0, 0);
    expect(s.players[me].active!.markers).toEqual([
      { kind: 'reduceIncoming', amount: 30, untilTurn: s0.turn + 1 },
    ]);
  });
});

describe('Graveler', () => {
  test('Rock Cannon does 40 for each heads before the first tails', () => {
    const results = new Set<number>();
    for (let seed = 1; seed <= 30; seed++) {
      const { s: s0, me, opp } = game(ALL, ALL, { seed });
      swapActiveTo(s0, me, GRAVELER);
      swapActiveTo(s0, opp, GOLEM);
      fighting(s0, me, 1);
      const s = attack(s0, 0);
      const flips = s.log.slice(s0.log.length);
      const heads = flips.filter((l) => l.text === 'Coin flip: heads').length;
      const tails = flips.filter((l) => l.text === 'Coin flip: tails').length;
      expect(tails).toBe(1);
      // Golem ex has 330 HP and no Weakness to Fighting.
      expect(s.players[opp].active!.damage).toBe(40 * heads);
      results.add(heads);
    }
    expect(results.size).toBeGreaterThan(1);
  });
});

describe('Golem ex', () => {
  test('Dynamic Roll puts +120 on itself for your next turn; Rock Blaster then does 180 + 120', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, GOLEM);
    swapActiveTo(s0, opp, GOLEM);
    fighting(s0, me, 3);
    let s = attack(s0, 0);
    expect(s.players[me].active!.markers).toEqual([
      { kind: 'increaseOutgoing', amount: 120, untilTurn: s0.turn + 2 },
    ]);
    expect(s.players[opp].active!.damage).toBe(50);
    s = act(engine, s, { type: 'endTurn' });
    expect(s.current).toBe(me);
    s.players[opp].active!.damage = -300; // a big HP buffer so the Knock Out doesn't hide the number
    const before = s.players[opp].active!.damage;
    s = attack(s, 1);
    expect(s.players[opp].active!.damage - before).toBe(300);
  });

  test('Rock Blaster ignores Resistance', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, GOLEM);
    swapActiveTo(s0, opp, ID.cresselia);
    s0.players[opp].active!.damage = -300;
    fighting(s0, me, 3);
    const s = attack(s0, 1);
    expect(s.players[opp].active!.damage).toBe(-300 + 180);
  });
});

const ONIX_DECK = { [ONIX]: 30, [GOLEM]: 4, [ID.fighting]: 20 };

describe('Onix', () => {
  test('Thumpalanche discards 5 and does 80 for each Pokémon with Retreat Cost exactly 4', () => {
    const { s: s0, me, opp } = game(ONIX_DECK, ONIX_DECK);
    swapActiveTo(s0, me, ONIX);
    swapActiveTo(s0, opp, GOLEM);
    s0.players[me].deck = s0.players[me].deck.filter(
      (u) => ![ONIX, ID.fighting].includes(s0.cards[u]!.defId) || true,
    );
    // Arrange the top 5: two Onix (Retreat 4), one Geodude-like Retreat 2, two Energy.
    const onix = s0.players[me].deck.filter((u) => s0.cards[u]!.defId === ONIX);
    const energy = s0.players[me].deck.filter((u) => s0.cards[u]!.defId === ID.fighting);
    const rest = s0.players[me].deck.filter(
      (u) => !onix.slice(0, 2).includes(u) && !energy.slice(0, 3).includes(u),
    );
    s0.players[me].deck = [onix[0]!, energy[0]!, onix[1]!, energy[1]!, energy[2]!, ...rest];
    attachFromDeck(s0, me, ID.fighting);
    attachFromDeck(s0, me, ID.fighting);
    const top = s0.players[me].deck.slice(0, 5);
    const deckBefore = s0.players[me].deck.length;
    const s = attack(s0, 0);
    const fours = top.filter((u) => s0.cards[u]!.defId === ONIX).length;
    expect(s.players[me].deck.length).toBe(deckBefore - 5);
    expect(s.players[opp].active!.damage).toBe(80 * fours);
  });

  test('with fewer than 5 cards it discards what is there', () => {
    const { s: s0, me, opp } = game(ONIX_DECK, ONIX_DECK);
    swapActiveTo(s0, me, ONIX);
    swapActiveTo(s0, opp, GOLEM);
    attachFromDeck(s0, me, ID.fighting);
    attachFromDeck(s0, me, ID.fighting);
    s0.players[me].deck = s0.players[me].deck.slice(0, 2);
    const s = attack(s0, 0);
    expect(s.players[me].deck).toHaveLength(0);
  });
});

describe('Rhyhorn', () => {
  test('Push Down lets the opponent choose their new Active Pokémon', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, RHYHORN);
    swapActiveTo(s0, opp, GEODUDE);
    for (let i = 0; i < 2; i++) {
      benchFromHand(s0, opp, giveCard(s0, opp, GEODUDE));
    }
    fighting(s0, me, 2);
    const s = attack(s0, 0);
    expect(s.prompt?.player).toBe(opp);
    const done = answer(s, s.prompt!.options[1]!.id);
    expect(done.players[opp].bench).toHaveLength(2);
    expect(done.players[opp].active!.damage).toBe(0);
  });

  test('with no Bench the attack just does its damage', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, RHYHORN);
    swapActiveTo(s0, opp, GEODUDE);
    s0.players[opp].bench = [];
    fighting(s0, me, 2);
    const s = attack(s0, 0);
    expect(s.prompt).toBeNull();
    expect(s.players[opp].active!.damage).toBe(20);
  });
});

describe('Rhydon', () => {
  test('Charismatic Drill does 40, or 180 after Giovanni’s Charisma this turn', () => {
    const run = (played: boolean) => {
      const { s: s0, me, opp } = game(ALL, ALL);
      swapActiveTo(s0, me, RHYDON);
      swapActiveTo(s0, opp, GOLEM);
      fighting(s0, me, 3);
      if (played) s0.players[me].supporterPlayed = { turn: s0.turn, name: "Giovanni's Charisma" };
      return attack(s0, 1).players[opp].active!.damage;
    };
    expect(run(false)).toBe(40);
    expect(run(true)).toBe(180);
  });
});
