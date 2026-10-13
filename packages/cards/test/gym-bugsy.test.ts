import { describe, expect, test } from 'vitest';
import { GYM_DECKS } from '../src/gym.ts';
import {
  act,
  assertGymDeck,
  attachFromDeck,
  benchFromHand,
  engine,
  game,
  giveCard,
  resolvePrompts,
  swapActiveTo,
} from './helpers.ts';

const SCYTHER = 'sv05-001';
const SCIZOR = 'sv05-111';
const HERACROSS = 'sv06-008';
const LEDYBA = 'sv07-002';
const LEDIAN = 'sv07-003';
const GRASS = 'mee-001';
const METAL = 'mee-008';
const GEODUDE = 'sv03.5-074';
const spec = {
  [SCYTHER]: 6,
  [SCIZOR]: 4,
  [HERACROSS]: 4,
  [LEDYBA]: 6,
  [LEDIAN]: 4,
  [GEODUDE]: 4,
  [GRASS]: 20,
  [METAL]: 20,
};
const attack = (s: Parameters<typeof act>[1], i: number) =>
  act(engine, s, { type: 'attack', attackIndex: i });
const tank = (s: ReturnType<typeof game>['s'], opp: 0 | 1) => {
  swapActiveTo(s, opp, HERACROSS);
  s.players[opp].active!.damage = -500;
};
const dealt = (s: ReturnType<typeof game>['s'], opp: 0 | 1) => s.players[opp].active!.damage + 500;

describe('Bugsy deck', () => {
  test('60 playable, Gym-legal cards within the deck rules', () => assertGymDeck(GYM_DECKS.bugsy));
});

describe('Scyther', () => {
  test("Slashing Strike does 60 and can't be used again on the next turn", () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, SCYTHER);
    tank(s0, opp);
    attachFromDeck(s0, me, GRASS);
    attachFromDeck(s0, me, GRASS);
    const s = attack(s0, 1);
    expect(dealt(s, opp)).toBe(60);
    expect(s.players[me].active!.attackLocks['Slashing Strike']).toBeGreaterThan(s.turn);
  });
});

describe('Scizor ex', () => {
  test('Steel Wing does 70 and reduces damage taken by 50', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, SCIZOR);
    tank(s0, opp);
    attachFromDeck(s0, me, GRASS);
    attachFromDeck(s0, me, GRASS);
    const s = attack(s0, 0);
    expect(dealt(s, opp)).toBe(70);
    expect(s.players[me].active!.markers).toContainEqual(
      expect.objectContaining({ kind: 'reduceIncoming', amount: 50 }),
    );
  });

  test('Cross Breaker discards up to 2 {M} Energy and does 120 for each', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, SCIZOR);
    tank(s0, opp);
    for (let i = 0; i < 3; i++) attachFromDeck(s0, me, METAL);
    const s = resolvePrompts(attack(s0, 1));
    const discarded = 3 - s.players[me].active!.energy.length;
    expect(discarded).toBeGreaterThanOrEqual(0);
    expect(discarded).toBeLessThanOrEqual(2);
    expect(dealt(s, opp)).toBe(120 * discarded);
  });

  test('Cross Breaker with 2 discarded does 240', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, SCIZOR);
    tank(s0, opp);
    for (let i = 0; i < 2; i++) attachFromDeck(s0, me, METAL);
    let s = attack(s0, 1);
    while (s.prompt) {
      const pr = s.prompt;
      s = act(engine, s, {
        type: 'answer',
        optionId: pr.selected.length < pr.max && pr.options[0] ? pr.options[0].id : 'done',
      });
    }
    expect(s.players[me].active!.energy).toHaveLength(0);
    expect(dealt(s, opp)).toBe(240);
  });
});

describe('Heracross', () => {
  test('Body Slam does 60 and Paralyzes the Defending Pokémon on heads only', () => {
    let paralyzed = 0;
    let not = 0;
    for (let seed = 1; seed < 40 && (paralyzed === 0 || not === 0); seed++) {
      const { s: s0, me, opp } = game(spec, spec, { seed });
      swapActiveTo(s0, me, HERACROSS);
      tank(s0, opp);
      for (const e of [GRASS, GRASS, GRASS]) attachFromDeck(s0, me, e);
      const s = attack(s0, 0);
      expect(dealt(s, opp)).toBe(60);
      if (s.players[opp].active!.conditions.rotation === 'paralyzed') paralyzed++;
      else not++;
    }
    expect(paralyzed).toBeGreaterThan(0);
    expect(not).toBeGreaterThan(0);
  });
});

describe('Ledian', () => {
  test('Swift does 70 to a Pokémon weak to Grass, ignoring Weakness', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, LEDIAN);
    swapActiveTo(s0, opp, GEODUDE); // weak to Grass: Swift ignores it
    s0.players[opp].active!.damage = -500;
    attachFromDeck(s0, me, GRASS);
    attachFromDeck(s0, me, GRASS);
    const s = attack(s0, 0);
    expect(dealt(s, opp)).toBe(70);
  });

  test("Glittering Star Pattern can switch in an opponent's Benched Pokémon with 90 HP or less remaining", () => {
    const { s: s0, me, opp } = game(spec, spec, { turn: 3 });
    benchFromHand(s0, me, giveCard(s0, me, LEDYBA));
    const benched = giveCard(s0, opp, LEDYBA);
    benchFromHand(s0, opp, benched);
    const ledian = giveCard(s0, me, LEDIAN);
    let s = act(engine, s0, { type: 'evolve', uid: ledian, target: { player: me, zone: 'bench', index: 0 } });
    expect(s.prompt).not.toBeNull();
    // Answer yes (the first option), then pick the only eligible Pokémon.
    for (let guard = 0; s.prompt && guard < 5; guard++) {
      s = act(engine, s, { type: 'answer', optionId: s.prompt.options[0]!.id });
    }
    expect(s.players[opp].active!.stack[0]).toBe(benched);
  });
});
