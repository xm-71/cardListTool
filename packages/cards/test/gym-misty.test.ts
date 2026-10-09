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
  has,
  giveCard,
  registry,
  sv,
  swapActiveTo,
} from './helpers.ts';

const STARYU = sv('120');
const STARMIE = sv('121');
const KRABBY = sv('098');
const KINGLER = sv('099');
const TENTACOOL = sv('072');
const TENTACRUEL = sv('073');
const W = 'mee-003';
const ALL = {
  [STARYU]: 4,
  [STARMIE]: 4,
  [KRABBY]: 4,
  [KINGLER]: 4,
  [TENTACOOL]: 4,
  [TENTACRUEL]: 4,
  [ID.cresselia]: 4,
  [ID.airBalloon]: 2,
  [W]: 20,
};
const attack = (s: GameState, i = 0) => act(engine, s, { type: 'attack', attackIndex: i });
const water = (s: GameState, p: 0 | 1, n: number) => {
  for (let i = 0; i < n; i++) attachFromDeck(s, p, W);
};
const buffer = (s: GameState, opp: 0 | 1) => {
  swapActiveTo(s, opp, ID.cresselia);
  s.players[opp].active!.damage = -400;
};

test('Misty deck: 60 playable cards', () => {
  const deck = GYM_DECKS.misty as DeckList;
  expect(deck.cards.reduce((n, c) => n + c.count, 0)).toBe(60);
  for (const c of deck.cards) expect(isPlayable(registry.defs[c.id]!, registry), c.id).toBe(true);
});

describe('Staryu', () => {
  test('Swift ignores Weakness and effects on the Defending Pokémon', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, STARYU);
    water(s0, me, 2);
    swapActiveTo(s0, opp, STARYU); // Water vs Lightning weak: not weak to Water; use a damage-reducing marker instead
    s0.players[opp].active!.markers.push({ kind: 'reduceIncoming', amount: 20, untilTurn: s0.turn + 1 });
    const s = attack(s0, 0);
    expect(s.players[opp].active!.damage).toBe(30);
  });
});

describe('Starmie', () => {
  const setup = (benchCount: number) => {
    const g = game(ALL, ALL);
    swapActiveTo(g.s, g.me, STARMIE);
    for (let i = 0; i < benchCount; i++) benchFromHand(g.s, g.me, giveCard(g.s, g.me, STARYU));
    g.s.players[g.me].bench = g.s.players[g.me].bench.slice(0, benchCount);
    // Starmie is already evolved in play (test setup), so it may use its Ability.
    g.s.players[g.me].active!.becameActiveTurn = 0;
    return g;
  };
  const comet = (s: GameState) =>
    ({
      type: 'useAbility',
      slot: { player: s.current, zone: 'active' },
      ability: 'Mysterious Comet',
    }) as const;
  const useComet = (s: GameState) => act(engine, s, comet(s));

  test('is not offered when Starmie is your only Pokémon in play', () => {
    const { s } = setup(0);
    expect(has(engine.getLegalActions(s, s.current), 'useAbility')).toBe(false);
  });

  test('puts 2 damage counters on a chosen Pokémon, then discards Starmie; the Bench promotes', () => {
    const { s: s0, me, opp } = setup(2);
    benchFromHand(s0, opp, giveCard(s0, opp, STARYU));
    let s = useComet(s0);
    expect(s.prompt?.player).toBe(me); // which Pokémon gets the counters
    s = answer(s, s.prompt!.options[0]!.id); // the opposing Active
    expect(s.players[opp].active!.damage).toBe(20);
    expect(s.prompt?.player).toBe(me); // choose a new Active Pokémon
    s = answer(s, s.prompt!.options[0]!.id);
    expect(s.players[me].active).not.toBeNull();
    expect(s.players[me].discard.some((u) => s.cards[u]!.defId === STARMIE)).toBe(true);
  });
});

describe('Krabby', () => {
  test('Salt Water attaches up to 2 Basic {W} Energy on heads and nothing on tails', () => {
    const counts = new Set<number>();
    for (let seed = 1; seed <= 20; seed++) {
      const { s: s0, me } = game(ALL, ALL, { seed });
      swapActiveTo(s0, me, KRABBY);
      water(s0, me, 1);
      const before = s0.players[me].active!.energy.length;
      let s = attack(s0, 0);
      const heads = s.log.slice(s0.log.length).some((l) => l.text === 'Coin flip: heads');
      while (s.prompt) {
        const o = s.prompt.options.find((x) => !s.prompt!.selected.includes(x.id));
        s = answer(s, s.prompt.selected.length >= 2 || !o ? 'done' : o.id);
      }
      const gained = s.players[me].active!.energy.length - before;
      expect(gained).toBe(heads ? 2 : 0);
      counts.add(gained);
    }
    expect(counts.size).toBe(2);
  });
});

describe('Kingler', () => {
  test('Hammer Arm does 90 and discards the top card of the opponent’s deck', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, KINGLER);
    buffer(s0, opp);
    water(s0, me, 3);
    const top = s0.players[opp].deck[0]!;
    const s = attack(s0, 0);
    expect(s.players[opp].active!.damage).toBe(-400 + 90);
    expect(s.players[opp].discard).toContain(top);
  });
});

describe('Tentacruel', () => {
  test('Poisonous Whip poisons the Defending Pokémon', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, TENTACRUEL);
    buffer(s0, opp);
    water(s0, me, 2);
    const s = attack(s0, 0);
    expect(s.players[opp].active!.conditions.poisoned).toBe(true);
  });

  test('Tentacular Panic does 90 per heads; the first flip tails confuses', () => {
    let sawConfused = false;
    let sawHeads = false;
    for (let seed = 1; seed <= 30; seed++) {
      const { s: s0, me, opp } = game(ALL, ALL, { seed });
      swapActiveTo(s0, me, TENTACRUEL);
      buffer(s0, opp);
      water(s0, me, 3);
      const s = attack(s0, 1);
      const flips = s.log.slice(s0.log.length).filter((l) => l.text.startsWith('Coin flip'));
      const heads = flips.filter((l) => l.text.endsWith('heads')).length;
      expect(s.players[opp].active!.damage).toBe(-400 + 90 * heads);
      const confused = s.players[opp].active!.conditions.rotation === 'confused';
      expect(confused).toBe(heads === 0);
      sawConfused ||= confused;
      sawHeads ||= heads > 0;
    }
    expect(sawConfused && sawHeads).toBe(true);
  });
});
