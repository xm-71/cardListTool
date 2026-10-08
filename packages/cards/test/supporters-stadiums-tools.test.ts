import { describe, expect, test } from 'vitest';
import { getRetreatCostForTest } from './retreat.ts';
import {
  ID,
  act,
  answer,
  answerCards,
  attachFromDeck,
  benchFromHand,
  defIdsOf,
  engine,
  game,
  giveCard,
  has,
  inHand,
  playTrainer,
  swapActiveTo,
} from './helpers.ts';
import type { GameState, PlayerId } from '@ptcg/engine';

const dark = { [ID.gastly]: 8, [ID.seviper]: 4, [ID.megaGengar]: 2, [ID.haunter]: 2 };
const psy = { [ID.meloetta]: 6, [ID.megaDiancie]: 2, [ID.mimikyu]: 4, [ID.psychic]: 20 };

function emptyHand(s: GameState, p: PlayerId) {
  s.players[p].deck.push(...s.players[p].hand.splice(0));
}

describe("Lillie's Determination", () => {
  test('shuffles the hand into the deck and draws 8 with 6 Prizes left, 6 otherwise', () => {
    const { s: s0, me } = game({ ...dark, [ID.lillie]: 4 });
    const lillie = inHand(s0, me, ID.lillie);
    expect(act(engine, s0, playTrainer(lillie)).players[me].hand).toHaveLength(8);

    const { s: s1, me: m1 } = game({ ...dark, [ID.lillie]: 4 });
    s1.players[m1].deck.push(s1.players[m1].prizes.pop()!);
    const l1 = inHand(s1, m1, ID.lillie);
    expect(act(engine, s1, playTrainer(l1)).players[m1].hand).toHaveLength(6);
  });
});

describe('Arven', () => {
  test('puts an Item and a Pokémon Tool from the deck into the hand', () => {
    const { s: s0, me } = game({ ...dark, [ID.arven]: 2, [ID.nestBall]: 2, [ID.punkHelmet]: 2 });
    emptyHand(s0, me);
    const arven = giveCard(s0, me, ID.arven);
    let s = act(engine, s0, playTrainer(arven));
    s = answerCards(s, [ID.nestBall]);
    s = answerCards(s, [ID.punkHelmet]);
    expect(defIdsOf(s, s.players[me].hand).sort()).toEqual([ID.nestBall, ID.punkHelmet].sort());
  });
});

describe("Boss's Orders", () => {
  test("switches one of the opponent's Benched Pokémon into the Active Spot, and needs one", () => {
    const { s: s0, me, opp } = game({ ...dark, [ID.boss]: 2 });
    const boss = inHand(s0, me, ID.boss);
    expect(engine.getLegalActions(s0, me)).not.toContainEqual(playTrainer(boss));
    benchFromHand(s0, opp, giveCard(s0, opp, ID.seviper));
    const target = s0.players[opp].bench[0]!.stack[0];
    const s = act(engine, s0, playTrainer(boss));
    expect(s.players[opp].active!.stack[0]).toBe(target);
  });
});

describe('Iono', () => {
  test('both hands go to the bottom of the decks, then each player draws one card per remaining Prize', () => {
    const { s: s0, me, opp } = game({ ...dark, [ID.iono]: 2 });
    s0.players[opp].deck.push(...s0.players[opp].prizes.splice(0, 2)); // opponent has 4 Prizes left
    const iono = inHand(s0, me, ID.iono);
    const oppHand = [...s0.players[opp].hand];
    const s = act(engine, s0, playTrainer(iono));
    expect(s.players[me].hand).toHaveLength(6);
    expect(s.players[opp].hand).toHaveLength(4);
    expect(s.players[opp].deck.slice(-oppHand.length).sort()).toEqual(oppHand.sort());
  });

  test('when both hands are empty nobody draws', () => {
    const { s: s0, me, opp } = game({ ...dark, [ID.iono]: 2 });
    emptyHand(s0, me);
    emptyHand(s0, opp);
    const iono = giveCard(s0, me, ID.iono);
    const s = act(engine, s0, playTrainer(iono));
    expect(s.players[me].hand).toHaveLength(0);
    expect(s.players[opp].hand).toHaveLength(0);
  });
});

describe("Professor's Research", () => {
  test('discards the hand and draws 7', () => {
    const { s: s0, me } = game({ ...dark, [ID.research]: 2 });
    const research = inHand(s0, me, ID.research);
    const handBefore = s0.players[me].hand.filter((u) => u !== research);
    const s = act(engine, s0, playTrainer(research));
    expect(s.players[me].hand).toHaveLength(7);
    expect(s.players[me].discard).toEqual(expect.arrayContaining(handBefore));
  });
});

describe("Wally's Compassion", () => {
  test('heals a damaged Mega Pokémon ex fully and returns its Energy to the hand', () => {
    const { s: s0, me } = game({ ...psy, [ID.wally]: 2 });
    swapActiveTo(s0, me, ID.megaDiancie);
    const e = attachFromDeck(s0, me, ID.psychic);
    const wally = inHand(s0, me, ID.wally);
    expect(engine.getLegalActions(s0, me)).not.toContainEqual(playTrainer(wally));
    s0.players[me].active!.damage = 120;
    const s = act(engine, s0, playTrainer(wally));
    expect(s.players[me].active!.damage).toBe(0);
    expect(s.players[me].active!.energy).toEqual([]);
    expect(s.players[me].hand).toContain(e);
  });
});

describe('Mystery Garden', () => {
  test('discard an Energy from hand to draw up to the number of {P} Pokémon in play, once per turn', () => {
    const { s: s0, me } = game({ ...psy, [ID.mysteryGarden]: 2 });
    emptyHand(s0, me);
    swapActiveTo(s0, me, ID.meloetta);
    for (let i = 0; i < 3; i++) benchFromHand(s0, me, giveCard(s0, me, ID.meloetta));
    const garden = giveCard(s0, me, ID.mysteryGarden);
    let s = act(engine, s0, playTrainer(garden));
    expect(has(engine.getLegalActions(s, me), 'useStadium')).toBe(false); // no Energy in hand
    giveCard(s, me, ID.psychic);
    s = act(engine, s, { type: 'useStadium' });
    expect(s.players[me].hand).toHaveLength(4);
    expect(has(engine.getLegalActions(s, me), 'useStadium')).toBe(false);
  });
});

describe('Risky Ruins', () => {
  test('a Basic non-{D} Pokémon put onto the Bench gets 2 damage counters; a {D} one does not', () => {
    const mixed = { [ID.gastly]: 6, [ID.meloetta]: 6, [ID.riskyRuins]: 2, [ID.nestBall]: 4 };
    const { s: s0, me } = game(mixed);
    const ruins = inHand(s0, me, ID.riskyRuins);
    let s = act(engine, s0, playTrainer(ruins));
    s = act(engine, s, playTrainer(giveCard(s, me, ID.nestBall)));
    s = answerCards(s, [ID.meloetta]);
    s = act(engine, s, playTrainer(giveCard(s, me, ID.nestBall)));
    s = answerCards(s, [ID.gastly]);
    const bench = s.players[me].bench;
    expect(bench.map((b) => [s.cards[b.stack[0]!]!.defId, b.damage])).toEqual([
      [ID.meloetta, 20],
      [ID.gastly, 0],
    ]);
  });

  test('also applies to a Basic played from hand', () => {
    const { s: s0, me } = game({ [ID.meloetta]: 8, [ID.riskyRuins]: 2 });
    let s = act(engine, s0, playTrainer(inHand(s0, me, ID.riskyRuins)));
    s = act(engine, s, { type: 'playBasic', uid: giveCard(s, me, ID.meloetta) });
    expect(s.players[me].bench.at(-1)!.damage).toBe(20);
  });
});

describe('Air Balloon', () => {
  test('reduces the Retreat Cost by 2', () => {
    const { s: s0, me } = game({ ...dark, [ID.airBalloon]: 2 });
    swapActiveTo(s0, me, ID.megaGengar); // retreat 2
    const s = act(engine, s0, {
      type: 'playTrainer',
      uid: inHand(s0, me, ID.airBalloon),
      target: { player: me, zone: 'active' },
    });
    expect(getRetreatCostForTest(s, me)).toBe(0);
  });
});

describe('Punk Helmet', () => {
  /** Meloetta (40 HP left) Knocks Out a Helmeted Gastly with Magical Shot and is Knocked Out by the Helmet. */
  function doubleKo(prizesEach?: number) {
    const mixed = {
      [ID.meloetta]: 4,
      [ID.mimikyu]: 4,
      [ID.gastly]: 4,
      [ID.seviper]: 4,
      [ID.punkHelmet]: 2,
      [ID.psychic]: 20,
    };
    const { s: s0, me, opp } = game(mixed);
    swapActiveTo(s0, me, ID.meloetta);
    swapActiveTo(s0, opp, ID.gastly);
    s0.players[me].active!.damage = 50;
    s0.players[opp].active!.damage = 30;
    const helmet = giveCard(s0, opp, ID.punkHelmet);
    s0.players[opp].hand.splice(s0.players[opp].hand.indexOf(helmet), 1);
    s0.players[opp].active!.tool = helmet;
    attachFromDeck(s0, me, ID.psychic);
    attachFromDeck(s0, me, ID.psychic);
    for (let i = 0; i < 2; i++) {
      benchFromHand(s0, me, giveCard(s0, me, ID.mimikyu));
      benchFromHand(s0, opp, giveCard(s0, opp, ID.seviper));
    }
    if (prizesEach !== undefined) {
      for (const p of [me, opp]) s0.players[p].deck.push(...s0.players[p].prizes.splice(prizesEach));
    }
    return { s: act(engine, s0, { type: 'attack', attackIndex: 1 }), me, opp };
  }

  test('Knocks Out the attacker too; both take Prizes and the defending player promotes first', () => {
    const ko = doubleKo();
    const { me, opp } = ko;
    let s = ko.s;
    expect(s.players[me].prizes).toHaveLength(5);
    expect(s.players[opp].prizes).toHaveLength(5);
    expect(s.prompt?.player).toBe(opp);
    s = answer(s, s.prompt!.options[0]!.id);
    expect(s.prompt?.player).toBe(me);
    s = answer(s, s.prompt!.options[0]!.id);
    expect(s.players[me].active).not.toBeNull();
    expect(s.players[opp].active).not.toBeNull();
    expect(s.current).toBe(opp);
  });

  test('if both players take their last Prize at once, the game is a draw', () => {
    const { s } = doubleKo(1);
    expect(s.result).toEqual({ winner: 'draw', reason: 'prizes' });
  });
});
