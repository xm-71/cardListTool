import { describe, expect, test } from 'vitest';
import type { GameState, PlayerId } from '@ptcg/engine';
import {
  ID,
  act,
  answerCards,
  attachFromDeck,
  benchFromHand,
  engine,
  game,
  giveCard,
  has,
  inHand,
  resolvePrompts,
  swapActiveTo,
} from './helpers.ts';

const gengarDeck = {
  [ID.gastly]: 6,
  [ID.haunter]: 2,
  [ID.megaGengar]: 6,
  [ID.toxel]: 4,
  [ID.toxtricity]: 4,
  [ID.sableye]: 4,
  [ID.seviper]: 4,
  [ID.eternatus]: 4,
  [ID.riskyRuins]: 2,
};

const prizesTaken = (s: GameState, p: PlayerId) => 6 - s.players[p].prizes.length;
const flips = (s: GameState, from: number) =>
  s.log
    .slice(from)
    .filter((e) => e.type === 'coinFlip')
    .map((e) => e.text.endsWith('heads'));

/** `me` attacks with Mega Gengar ex (Void Gale, 230) into `defender`. */
function voidGale(defender: string, oppBench: string[] = [], defenderDamage = 0) {
  const { s: s0, me, opp } = game(gengarDeck);
  swapActiveTo(s0, me, ID.megaGengar);
  attachFromDeck(s0, me, ID.darkness);
  attachFromDeck(s0, me, ID.darkness);
  swapActiveTo(s0, opp, defender);
  s0.players[opp].active!.damage = defenderDamage;
  for (const id of oppBench) benchFromHand(s0, opp, giveCard(s0, opp, id));
  return { s: act(engine, s0, { type: 'attack', attackIndex: 0 }), me, opp };
}

describe('Mega Gengar ex', () => {
  test('Shadowy Concealment: an opposing ex Knocking Out a {D} Pokémon takes 1 fewer Prize', () => {
    const { s, me } = voidGale(ID.gastly, [ID.megaGengar, ID.gastly]);
    expect(prizesTaken(s, me)).toBe(0);
  });

  test('Shadowy Concealment applies when Mega Gengar ex itself is Knocked Out (3 → 2)', () => {
    const { s, me } = voidGale(ID.megaGengar, [ID.gastly], 200);
    expect(prizesTaken(s, me)).toBe(2);
  });

  test('Shadowy Concealment does not stack', () => {
    const { s, me } = voidGale(ID.megaGengar, [ID.megaGengar, ID.gastly], 200);
    expect(prizesTaken(s, me)).toBe(2);
  });

  test('without Mega Gengar ex in play, Prizes are normal', () => {
    const { s, me } = voidGale(ID.gastly, [ID.gastly]);
    expect(prizesTaken(s, me)).toBe(1);
  });

  test('Void Gale moves an Energy from Mega Gengar ex to a Benched Pokémon', () => {
    const { s: s0, me } = game(gengarDeck);
    swapActiveTo(s0, me, ID.megaGengar);
    attachFromDeck(s0, me, ID.darkness);
    attachFromDeck(s0, me, ID.darkness);
    benchFromHand(s0, me, giveCard(s0, me, ID.gastly));
    const s = resolvePrompts(act(engine, s0, { type: 'attack', attackIndex: 0 }));
    expect(s.players[me].bench[0]!.energy).toHaveLength(1);
    expect(s.players[me].active!.energy).toHaveLength(1);
  });
});

describe('Toxel', () => {
  test('Call for Family offers only as many Basics as there are free Bench spots', () => {
    const { s: s0, me } = game(gengarDeck);
    swapActiveTo(s0, me, ID.toxel);
    attachFromDeck(s0, me, ID.darkness);
    for (let i = 0; i < 4; i++) benchFromHand(s0, me, giveCard(s0, me, ID.gastly));
    const s = act(engine, s0, { type: 'attack', attackIndex: 0 });
    expect(s.prompt!.max).toBe(1);
    const done = answerCards(s, [ID.seviper]);
    expect(done.players[me].bench).toHaveLength(5);
  });
});

describe('Toxtricity', () => {
  test('Sinister Surge attaches a Basic {D} Energy from the deck to a Benched {D} Pokémon and places 2 damage counters', () => {
    const { s: s0, me } = game(gengarDeck);
    swapActiveTo(s0, me, ID.toxtricity);
    benchFromHand(s0, me, giveCard(s0, me, ID.gastly));
    const surge = {
      type: 'useAbility',
      slot: { player: me, zone: 'active' },
      ability: 'Sinister Surge',
    } as const;
    expect(engine.getLegalActions(s0, me)).toContainEqual(surge);
    let s = act(engine, s0, surge);
    if (s.prompt) s = answerCards(s, [ID.darkness]);
    expect(s.players[me].bench[0]!.energy).toHaveLength(1);
    expect(s.players[me].bench[0]!.damage).toBe(20);
    expect(engine.getLegalActions(s, me)).not.toContainEqual(surge);
  });

  test('Sinister Surge needs a Benched {D} Pokémon', () => {
    const { s, me } = game(gengarDeck);
    swapActiveTo(s, me, ID.toxtricity);
    expect(has(engine.getLegalActions(s, me), 'useAbility')).toBe(false);
  });
});

describe('Sableye', () => {
  test('Cocky Claw does 20, or 90 with a Stage 2 {D} Pokémon on the Bench', () => {
    const run = (withStage2: boolean) => {
      const { s: s0, me, opp } = game(gengarDeck);
      swapActiveTo(s0, me, ID.sableye);
      swapActiveTo(s0, opp, ID.eternatus);
      attachFromDeck(s0, me, ID.darkness);
      if (withStage2) benchFromHand(s0, me, giveCard(s0, me, ID.megaGengar));
      return act(engine, s0, { type: 'attack', attackIndex: 0 }).players[opp].active!.damage;
    };
    expect(run(false)).toBe(20);
    expect(run(true)).toBe(90);
  });
});

describe('Seviper', () => {
  test('Excited Power adds 120 when a {D} Mega Evolution Pokémon ex is in play', () => {
    const run = (withMega: boolean) => {
      const { s: s0, me, opp } = game(gengarDeck);
      swapActiveTo(s0, me, ID.seviper);
      swapActiveTo(s0, opp, ID.megaGengar);
      for (let i = 0; i < 3; i++) attachFromDeck(s0, me, ID.darkness);
      if (withMega) benchFromHand(s0, me, giveCard(s0, me, ID.megaGengar));
      return act(engine, s0, { type: 'attack', attackIndex: 0 }).players[opp].active!.damage;
    };
    expect(run(false)).toBe(120);
    expect(run(true)).toBe(240);
  });
});

describe('Eternatus', () => {
  test('Shatter discards the Stadium in play', () => {
    const { s: s0, me, opp } = game(gengarDeck);
    swapActiveTo(s0, me, ID.eternatus);
    attachFromDeck(s0, me, ID.darkness);
    attachFromDeck(s0, me, ID.darkness);
    const ruins = inHand(s0, opp, ID.riskyRuins);
    s0.players[opp].hand.splice(s0.players[opp].hand.indexOf(ruins), 1);
    s0.stadium = { uid: ruins, owner: opp };
    const s = act(engine, s0, { type: 'attack', attackIndex: 0 });
    expect(s.stadium).toBeNull();
    expect(s.players[opp].discard).toContain(ruins);
  });

  test('Power Rush: on tails Eternatus cannot attack during its owner’s next turn', () => {
    for (const seed of [1, 2, 3, 4]) {
      const { s: s0, me, opp } = game(gengarDeck, undefined, { seed });
      swapActiveTo(s0, me, ID.eternatus);
      swapActiveTo(s0, opp, ID.megaGengar);
      for (let i = 0; i < 4; i++) attachFromDeck(s0, me, ID.darkness);
      const from = s0.log.length;
      let s = act(engine, s0, { type: 'attack', attackIndex: 1 });
      const [heads] = flips(s, from);
      if (s.prompt || s.result) continue;
      s = act(engine, s, { type: 'endTurn' });
      expect(has(engine.getLegalActions(s, me), 'attack')).toBe(!!heads);
      return;
    }
    throw new Error('no usable seed');
  });
});
