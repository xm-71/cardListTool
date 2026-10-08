import { describe, expect, test } from 'vitest';
import {
  ID,
  act,
  answer,
  answerCards,
  benchFromHand,
  defIdsOf,
  engine,
  game,
  giveCard,
  inHand,
  playTrainer,
} from './helpers.ts';

const base = { [ID.gastly]: 8, [ID.seviper]: 8, [ID.eternatus]: 2, [ID.haunter]: 2, [ID.megaGengar]: 2 };

describe('Nest Ball', () => {
  test('puts a Basic Pokémon from the deck onto the Bench', () => {
    const { s: s0, me } = game({ ...base, [ID.nestBall]: 2 });
    const ball = giveCard(s0, me, ID.nestBall);
    let s = act(engine, s0, playTrainer(ball));
    s = answerCards(s, [ID.seviper]);
    expect(
      defIdsOf(
        s,
        s.players[me].bench.map((b) => b.stack[0]!),
      ),
    ).toContain(ID.seviper);
    expect(s.players[me].discard).toContain(ball);
  });

  test('is not playable with a full Bench', () => {
    const { s, me } = game({ ...base, [ID.nestBall]: 2 });
    for (let i = 0; i < 5; i++) benchFromHand(s, me, giveCard(s, me, i < 3 ? ID.gastly : ID.seviper));
    const ball = giveCard(s, me, ID.nestBall);
    expect(engine.getLegalActions(s, me)).not.toContainEqual(playTrainer(ball));
  });

  test('with no Basic Pokémon left in the deck it can still be played and finds nothing', () => {
    const { s: s0, me } = game({ [ID.gastly]: 1, [ID.nestBall]: 2 });
    const p = s0.players[me];
    p.discard.push(...p.deck.filter((u) => s0.cards[u]!.defId === ID.gastly));
    p.deck = p.deck.filter((u) => s0.cards[u]!.defId !== ID.gastly);
    const ball = inHand(s0, me, ID.nestBall);
    const s = act(engine, s0, playTrainer(ball));
    expect(s.prompt).toBeNull();
    expect(s.players[me].bench).toHaveLength(0);
  });
});

describe('Buddy-Buddy Poffin', () => {
  test('benches up to 2 Basic Pokémon with 70 HP or less', () => {
    const { s: s0, me } = game({ ...base, [ID.poffin]: 2 });
    const poffin = giveCard(s0, me, ID.poffin);
    let s = act(engine, s0, playTrainer(poffin));
    expect(
      defIdsOf(
        s,
        s.prompt!.options.map((o) => o.uid!),
      ).every((id) => id === ID.gastly),
    ).toBe(true);
    s = answerCards(s, [ID.gastly, ID.gastly]);
    expect(s.players[me].bench).toHaveLength(2);
  });

  test('offers only as many picks as there are free Bench spots', () => {
    const { s: s0, me } = game({ ...base, [ID.poffin]: 2 });
    for (let i = 0; i < 4; i++) benchFromHand(s0, me, giveCard(s0, me, ID.seviper));
    const poffin = giveCard(s0, me, ID.poffin);
    const s = act(engine, s0, playTrainer(poffin));
    expect(s.prompt!.max).toBe(1);
  });
});

describe('Ultra Ball', () => {
  test('needs 2 other cards in hand', () => {
    const { s, me } = game({ ...base, [ID.ultraBall]: 2 });
    const p = s.players[me];
    p.deck.push(...p.hand.splice(0));
    const ball = giveCard(s, me, ID.ultraBall);
    giveCard(s, me, ID.gastly);
    expect(engine.getLegalActions(s, me)).not.toContainEqual(playTrainer(ball));
  });

  test('discards 2 cards, then puts a Pokémon from the deck into the hand', () => {
    const { s: s0, me } = game({ ...base, [ID.ultraBall]: 2 });
    const p = s0.players[me];
    p.deck.push(...p.hand.splice(0));
    const ball = giveCard(s0, me, ID.ultraBall);
    const a = giveCard(s0, me, ID.darkness);
    const b = giveCard(s0, me, ID.darkness);
    // exactly 2 other cards in hand: both are discarded without a prompt
    let s = act(engine, s0, playTrainer(ball));
    s = answerCards(s, [ID.megaGengar]);
    expect(s.players[me].discard).toEqual(expect.arrayContaining([a, b, ball]));
    expect(defIdsOf(s, s.players[me].hand)).toEqual([ID.megaGengar]);
  });
});

describe('Rare Candy', () => {
  test('evolves a Basic straight into its Stage 2', () => {
    const { s: s0, me } = game({ ...base, [ID.rareCandy]: 2 }, undefined, { turn: 3 });
    const active = s0.players[me].active!;
    s0.players[me].deck.push(...active.stack.splice(0));
    const gastly = giveCard(s0, me, ID.gastly);
    s0.players[me].hand.splice(s0.players[me].hand.indexOf(gastly), 1);
    active.stack = [gastly];
    const gengar = giveCard(s0, me, ID.megaGengar);
    const candy = giveCard(s0, me, ID.rareCandy);
    const s = act(engine, s0, playTrainer(candy));
    expect(s.players[me].active!.stack).toEqual([gastly, gengar]);
    expect(s.players[me].active!.evolvedTurn).toBe(s.turn);
  });

  test('is not playable without a matching Stage 2 in hand, or on the first turn', () => {
    const { s, me } = game({ ...base, [ID.rareCandy]: 2 }, undefined, { turn: 3 });
    const candy = giveCard(s, me, ID.rareCandy);
    s.players[me].deck.push(...s.players[me].hand.filter((u) => s.cards[u]!.defId === ID.megaGengar));
    s.players[me].hand = s.players[me].hand.filter((u) => s.cards[u]!.defId !== ID.megaGengar);
    expect(engine.getLegalActions(s, me)).not.toContainEqual(playTrainer(candy));

    const first = game({ ...base, [ID.rareCandy]: 2 }, undefined, { turn: 1 });
    giveCard(first.s, first.me, ID.megaGengar);
    const c2 = giveCard(first.s, first.me, ID.rareCandy);
    expect(engine.getLegalActions(first.s, first.me)).not.toContainEqual(playTrainer(c2));
  });
});

describe('Night Stretcher', () => {
  test('returns a Pokémon or Basic Energy from the discard pile to the hand', () => {
    const { s: s0, me } = game({ ...base, [ID.nightStretcher]: 2 });
    const g = giveCard(s0, me, ID.gastly);
    s0.players[me].hand.splice(s0.players[me].hand.indexOf(g), 1);
    s0.players[me].discard.push(g);
    const ns = giveCard(s0, me, ID.nightStretcher);
    let s = act(engine, s0, playTrainer(ns));
    if (s.prompt) s = answer(s, g);
    expect(s.players[me].hand).toContain(g);
  });

  test('is not playable with no Pokémon or Basic Energy in the discard pile', () => {
    const { s, me } = game({ ...base, [ID.nightStretcher]: 2 });
    const ns = giveCard(s, me, ID.nightStretcher);
    expect(engine.getLegalActions(s, me)).not.toContainEqual(playTrainer(ns));
  });
});

describe('Switch', () => {
  test('swaps the Active Pokémon with a Benched one, and needs a Bench', () => {
    const { s: s0, me } = game({ ...base, [ID.switch]: 2 });
    const sw = giveCard(s0, me, ID.switch);
    expect(engine.getLegalActions(s0, me)).not.toContainEqual(playTrainer(sw));
    benchFromHand(s0, me, giveCard(s0, me, ID.seviper));
    const benched = s0.players[me].bench[0]!.stack[0];
    const s = act(engine, s0, playTrainer(sw));
    expect(s.players[me].active!.stack[0]).toBe(benched);
  });
});

describe('Mega Signal', () => {
  test('puts a Mega Evolution Pokémon ex from the deck into the hand', () => {
    const { s: s0, me } = game({ ...base, [ID.megaSignal]: 2 });
    const sig = giveCard(s0, me, ID.megaSignal);
    let s = act(engine, s0, playTrainer(sig));
    expect(
      defIdsOf(
        s,
        s.prompt!.options.map((o) => o.uid!),
      ).every((id) => id === ID.megaGengar),
    ).toBe(true);
    s = answerCards(s, [ID.megaGengar]);
    expect(defIdsOf(s, s.players[me].hand)).toContain(ID.megaGengar);
  });
});

describe('Wondrous Patch', () => {
  const psy = { [ID.meloetta]: 6, [ID.wondrousPatch]: 2, [ID.psychic]: 10 };

  test('attaches a Basic Psychic Energy from the discard pile to a Benched Psychic Pokémon', () => {
    const { s: s0, me } = game(psy);
    benchFromHand(s0, me, giveCard(s0, me, ID.meloetta));
    const e = giveCard(s0, me, ID.psychic);
    s0.players[me].hand.splice(s0.players[me].hand.indexOf(e), 1);
    s0.players[me].discard.push(e);
    const patch = giveCard(s0, me, ID.wondrousPatch);
    const s = act(engine, s0, playTrainer(patch));
    expect(s.players[me].bench[0]!.energy).toEqual([e]);
  });

  test('is not playable without Psychic Energy in the discard pile', () => {
    const { s, me } = game(psy);
    benchFromHand(s, me, giveCard(s, me, ID.meloetta));
    const patch = giveCard(s, me, ID.wondrousPatch);
    expect(engine.getLegalActions(s, me)).not.toContainEqual(playTrainer(patch));
  });
});

describe('reveals', () => {
  test('Mega Signal shows the revealed card in the log', () => {
    const { s: s0, me } = game({ ...base, [ID.megaSignal]: 2 });
    let s = act(engine, s0, playTrainer(giveCard(s0, me, ID.megaSignal)));
    s = answerCards(s, [ID.megaGengar]);
    expect(s.log.some((e) => e.text === `Player ${me + 1} reveals Mega Gengar ex`)).toBe(true);
  });
});
