import { describe, expect, test } from 'vitest';
import type { GameState, PlayerId } from '@ptcg/engine';
import {
  ID,
  act,
  answerCards,
  attachFromDeck,
  benchFromHand,
  defIdsOf,
  engine,
  game,
  giveCard,
  inHand,
  playTrainer,
  resolvePrompts,
  swapActiveTo,
} from './helpers.ts';

const lucario = {
  [ID.riolu]: 6,
  [ID.megaLucario]: 4,
  [ID.makuhita]: 4,
  [ID.hariyama]: 2,
  [ID.solrock]: 2,
  [ID.lunatone]: 2,
  [ID.gastly]: 2,
  [ID.haunter]: 1,
  [ID.megaGengar]: 1,
  [ID.fightingGong]: 2,
  [ID.irisFightingSpirit]: 2,
  [ID.surfer]: 2,
  [ID.gravityMountain]: 2,
  [ID.premiumPowerPro]: 2,
  [ID.secretBox]: 1,
  [ID.nestBall]: 2,
  [ID.airBalloon]: 1,
  [ID.lillie]: 1,
  [ID.fighting]: 13,
};
const emptyHand = (s: GameState, p: PlayerId) => s.players[p].deck.push(...s.players[p].hand.splice(0));

describe('Fighting Gong', () => {
  test('puts a Basic {F} Energy or Basic {F} Pokémon from the deck into the hand, revealed', () => {
    const { s: s0, me } = game(lucario);
    emptyHand(s0, me);
    let s = act(engine, s0, playTrainer(giveCard(s0, me, ID.fightingGong)));
    const offered = defIdsOf(
      s,
      s.prompt!.options.map((o) => o.uid!),
    );
    expect(new Set(offered)).toEqual(new Set([ID.fighting, ID.riolu, ID.makuhita, ID.solrock, ID.lunatone]));
    s = answerCards(s, [ID.riolu]);
    expect(defIdsOf(s, s.players[me].hand)).toEqual([ID.riolu]);
    expect(s.log.some((e) => e.type === 'reveal' && e.text.endsWith('Riolu'))).toBe(true);
  });
});

describe('Gravity Mountain', () => {
  test('gives Stage 2 Pokémon −30 HP, Knocking Out one with 30 HP or less left', () => {
    const { s: s0, me, opp } = game(lucario);
    swapActiveTo(s0, opp, ID.megaGengar); // Stage 2, 350 HP
    s0.players[opp].active!.damage = 320;
    benchFromHand(s0, opp, giveCard(s0, opp, ID.gastly));
    const s = act(engine, s0, playTrainer(inHand(s0, me, ID.gravityMountain)));
    expect(6 - s.players[me].prizes.length).toBe(3);
  });

  test('the view shows the reduced HP', () => {
    const { s: s0, me, opp } = game(lucario);
    swapActiveTo(s0, opp, ID.megaGengar);
    const s = act(engine, s0, playTrainer(inHand(s0, me, ID.gravityMountain)));
    expect(engine.viewFor(s, me).opponent.active!.hp).toBe(320);
  });
});

describe("Iris's Fighting Spirit", () => {
  test('needs another card to discard, then draws until 6 cards in hand', () => {
    const { s: s0, me } = game(lucario);
    emptyHand(s0, me);
    const iris = giveCard(s0, me, ID.irisFightingSpirit);
    expect(engine.getLegalActions(s0, me)).not.toContainEqual(playTrainer(iris));
    const other = giveCard(s0, me, ID.fighting);
    giveCard(s0, me, ID.fighting);
    const s = resolvePrompts(act(engine, s0, playTrainer(iris)));
    expect(s.players[me].hand).toHaveLength(6);
    expect(s.players[me].discard).toEqual(expect.arrayContaining([iris]));
    expect(s.players[me].discard.some((u) => s.cards[u]!.defId === ID.fighting)).toBe(true);
    void other;
  });
});

describe('Premium Power Pro', () => {
  test('{F} attacks do 30 more to the opponent’s Active this turn only', () => {
    const { s: s0, me, opp } = game(lucario);
    swapActiveTo(s0, me, ID.riolu); // Accelerating Stab 30
    attachFromDeck(s0, me, ID.fighting);
    swapActiveTo(s0, opp, ID.lunatone); // no Fighting Weakness, so 60 can only come from the +30
    let s = act(engine, s0, playTrainer(giveCard(s0, me, ID.premiumPowerPro)));
    s = act(engine, s, { type: 'attack', attackIndex: 0 });
    expect(s.players[opp].active!.damage).toBe(60);
    s = act(engine, s, { type: 'endTurn' });
    expect(s.lingering).toEqual([]);
  });
});

describe('Secret Box', () => {
  test('discards 3 other cards and fetches an Item, a Tool, a Supporter and a Stadium', () => {
    const { s: s0, me } = game(lucario);
    emptyHand(s0, me);
    const box = giveCard(s0, me, ID.secretBox);
    for (let i = 0; i < 2; i++) giveCard(s0, me, ID.fighting);
    expect(engine.getLegalActions(s0, me)).not.toContainEqual(playTrainer(box));
    giveCard(s0, me, ID.fighting);
    let s = act(engine, s0, playTrainer(box));
    s = answerCards(s, [ID.nestBall]);
    s = answerCards(s, [ID.airBalloon]);
    s = answerCards(s, [ID.surfer]);
    s = answerCards(s, [ID.gravityMountain]);
    expect(new Set(defIdsOf(s, s.players[me].hand))).toEqual(
      new Set([ID.nestBall, ID.airBalloon, ID.surfer, ID.gravityMountain]),
    );
  });
});

describe('Surfer', () => {
  test('switches with a Benched Pokémon, then draws until 5 cards in hand', () => {
    const { s: s0, me } = game(lucario);
    emptyHand(s0, me);
    benchFromHand(s0, me, giveCard(s0, me, ID.solrock));
    const benched = s0.players[me].bench[0]!.stack[0];
    const s = act(engine, s0, playTrainer(giveCard(s0, me, ID.surfer)));
    expect(s.players[me].active!.stack[0]).toBe(benched);
    expect(s.players[me].hand).toHaveLength(5);
  });

  test('with no Bench it does nothing', () => {
    const { s: s0, me } = game(lucario);
    emptyHand(s0, me);
    const s = act(engine, s0, playTrainer(giveCard(s0, me, ID.surfer)));
    expect(s.players[me].hand).toHaveLength(0);
  });
});
