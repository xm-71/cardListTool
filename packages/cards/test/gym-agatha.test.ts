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
  resolvePrompts,
  sv,
  swapActiveTo,
} from './helpers.ts';

const GASTLY = sv('092');
const HAUNTER = sv('093');
const GENGAR = sv('094');
const ZUBAT = sv('041');
const GOLBAT = sv('042');
const P = 'mee-005';
const ALL = {
  [GASTLY]: 4,
  [HAUNTER]: 4,
  [GENGAR]: 4,
  [ID.megaGengar]: 2,
  [ZUBAT]: 4,
  [GOLBAT]: 4,
  [ID.boss]: 4,
  [ID.ultraBall]: 4,
  [P]: 20,
};
const attack = (s: GameState, i = 0) => act(engine, s, { type: 'attack', attackIndex: i });
const psy = (s: GameState, p: 0 | 1, n: number) => {
  for (let i = 0; i < n; i++) attachFromDeck(s, p, P);
};
/** A tanky neutral Defending Pokémon (Zubat: Fighting-resistant, Lightning-weak; our attackers are Psychic/Colorless). */
const buffer = (s: GameState, opp: 0 | 1) => {
  swapActiveTo(s, opp, ZUBAT);
  s.players[opp].active!.damage = -400;
};

describe('Agatha deck', () => {
  test('60 playable cards', () => {
    const deck = GYM_DECKS.agatha as DeckList;
    expect(deck.cards.reduce((n, c) => n + c.count, 0)).toBe(60);
    for (const c of deck.cards) expect(isPlayable(registry.defs[c.id]!, registry), c.id).toBe(true);
  });

  test('Haunter 093 satisfies Mega Gengar ex’s evolve-from-Haunter rule', () => {
    const { s: s0, me } = game(ALL, ALL, { turn: 3 });
    benchFromHand(s0, me, giveCard(s0, me, GASTLY));
    const slot = s0.players[me].bench[0]!;
    const haunter = giveCard(s0, me, HAUNTER);
    s0.players[me].hand.splice(s0.players[me].hand.indexOf(haunter), 1);
    slot.stack.push(haunter);
    slot.evolvedTurn = 0;
    slot.enteredTurn = 0;
    const mega = giveCard(s0, me, ID.megaGengar);
    const legal = engine.getLegalActions(s0, me);
    expect(legal).toContainEqual({
      type: 'evolve',
      uid: mega,
      target: { player: me, zone: 'bench', index: 0 },
    });
  });
});

describe('Haunter', () => {
  const evolve = (accept: boolean) => {
    const { s: s0, me, opp } = game(ALL, ALL, { turn: 3 });
    benchFromHand(s0, me, giveCard(s0, me, GASTLY));
    const boss = giveCard(s0, opp, ID.boss);
    const o = s0.players[opp];
    o.hand.splice(o.hand.indexOf(boss), 1);
    o.discard.push(boss);
    const haunter = giveCard(s0, me, HAUNTER);
    let s = act(engine, s0, {
      type: 'evolve',
      uid: haunter,
      target: { player: me, zone: 'bench', index: 0 },
    });
    s = answer(s, accept ? 'yes' : 'no');
    s = resolvePrompts(s);
    return { s, opp, boss };
  };

  test('Spirit Return puts a Supporter from the opponent’s discard pile into their hand', () => {
    const { s, opp, boss } = evolve(true);
    expect(s.players[opp].hand).toContain(boss);
    expect(s.players[opp].discard).not.toContain(boss);
  });

  test('is optional', () => {
    const { s, opp, boss } = evolve(false);
    expect(s.players[opp].discard).toContain(boss);
  });
});

describe('Gengar', () => {
  test('Poltergeist does 50 for each Trainer in the opponent’s hand and reveals it', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, GENGAR);
    psy(s0, me, 1);
    buffer(s0, opp);
    const o = s0.players[opp];
    o.deck.push(...o.hand.splice(0));
    for (const id of [ID.boss, ID.ultraBall, GASTLY]) giveCard(s0, opp, id);
    const s = attack(s0, 0);
    expect(s.players[opp].active!.damage).toBe(-400 + 100);
    expect(s.log.slice(s0.log.length).some((l) => l.type === 'reveal')).toBe(true);
  });

  test('Hollow Dive does 110 and puts 3 counters on Benched Pokémon in any split', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, GENGAR);
    psy(s0, me, 2);
    buffer(s0, opp);
    s0.players[opp].bench = [];
    for (let i = 0; i < 2; i++) benchFromHand(s0, opp, giveCard(s0, opp, GASTLY));
    let s = attack(s0, 1);
    for (let i = 0; i < 3 && s.prompt?.player === me; i++)
      s = answer(s, s.prompt.options[i === 0 ? 0 : 1]!.id);
    expect(s.players[opp].active!.damage).toBe(-400 + 110);
    expect(s.players[opp].bench.map((b) => b.damage).sort()).toEqual([10, 20]);
  });

  test('Hollow Dive with no Bench just does damage', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, GENGAR);
    psy(s0, me, 2);
    buffer(s0, opp);
    s0.players[opp].bench = [];
    const s = attack(s0, 1);
    expect(s.prompt).toBeNull();
  });
});

describe('Zubat', () => {
  const echo = (p: 0 | 1) =>
    ({ type: 'useAbility', slot: { player: p, zone: 'active' }, ability: 'Revealing Echo' }) as const;

  test('Revealing Echo reveals the opponent’s hand, once a turn, from the Active Spot only', () => {
    const { s: s0, me } = game(ALL, ALL);
    swapActiveTo(s0, me, ZUBAT);
    expect(engine.getLegalActions(s0, me)).toContainEqual(echo(me));
    const s = act(engine, s0, echo(me));
    expect(s.log.slice(s0.log.length).some((l) => l.type === 'reveal')).toBe(true);
    expect(engine.getLegalActions(s, me)).not.toContainEqual(echo(me));
  });

  test('is not available from the Bench', () => {
    const { s, me } = game(ALL, ALL);
    swapActiveTo(s, me, GASTLY);
    benchFromHand(s, me, giveCard(s, me, ZUBAT));
    const abilities = engine.getLegalActions(s, me).filter((a) => a.type === 'useAbility');
    expect(abilities).toHaveLength(0);
  });
});

describe('Golbat', () => {
  test('Skill Dive does 40 to the Active Pokémon (with Weakness) or 40 as counters to a Benched one', () => {
    const run = (target: 'active' | 'bench') => {
      const { s: s0, me, opp } = game(ALL, ALL);
      swapActiveTo(s0, me, GOLBAT);
      psy(s0, me, 1);
      swapActiveTo(s0, opp, GASTLY);
      s0.players[opp].active!.damage = -400;
      s0.players[opp].bench = [];
      benchFromHand(s0, opp, giveCard(s0, opp, GASTLY));
      let s = attack(s0, 0);
      s = answer(s, s.prompt!.options.find((o) => o.slot?.zone === target)!.id);
      return s.players[opp];
    };
    // Gastly is weak to Darkness, and Golbat is Darkness: 80 to the Active Pokémon.
    expect(run('active').active!.damage).toBe(-400 + 80);
    const b = run('bench');
    expect(b.bench[0]!.damage).toBe(40);
    expect(b.active!.damage).toBe(-400);
  });
});
