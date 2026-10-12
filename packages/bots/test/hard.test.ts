import { describe, expect, test } from 'vitest';
import { createEngine, type Action, type CardRegistry, type GameState, type PlayerId } from '@ptcg/engine';
import {
  act,
  attachFromDeck,
  benchFromHand,
  deckOf,
  giveCard,
  miniRegistry,
  pokemon,
  started,
  swapActiveTo,
} from '@ptcg/engine/testing';
import { createEasyBot } from '../src/easy.ts';
import { createHardBot, type HardOptions } from '../src/hard.ts';
import { createMediumBot } from '../src/medium.ts';

const tank = pokemon('tank', {
  hp: 200,
  isEx: true,
  retreat: 1,
  attacks: [
    {
      name: 'Slam',
      cost: ['Colorless', 'Colorless', 'Colorless', 'Colorless'],
      damage: 100,
      damageSuffix: '',
      text: '',
    },
  ],
});
const spare = pokemon('spare', { hp: 60, retreat: 0 });
// Its printed damage is 0, so `evaluate`'s threat check can't see the 250 the script really deals.
const sniper = pokemon('sniper', {
  hp: 100,
  attacks: [{ name: 'Snipe', cost: ['Colorless'], damage: 0, damageSuffix: '', text: '' }],
});
const registry: CardRegistry = miniRegistry([tank, spare, sniper], {
  sniper: { attacks: { 0: { damage: () => 250 } } },
});
const engine = createEngine(registry);
const spec = { 't-basic': 14, tank: 4, spare: 4, sniper: 4, 't-dark': 34 };
const decks = [deckOf(spec), deckOf(spec)] as [ReturnType<typeof deckOf>, ReturnType<typeof deckOf>];

/** Hard's side: an ex tank holding 1 Energy, a spare on the Bench. The opponent's sniper can Knock the tank out. */
function threatened(benchFiller: 'spare' | 't-basic' = 'spare'): { s: GameState; me: PlayerId } {
  let s = started(engine, spec, spec, 7);
  s = act(engine, s, { type: 'endTurn' });
  const me = s.current;
  const opp: PlayerId = me === 0 ? 1 : 0;
  swapActiveTo(s, me, 'tank');
  attachFromDeck(s, me, 't-dark');
  benchFromHand(s, me, giveCard(s, me, benchFiller));
  // No Energy in hand, so retreating is not undone by re-attaching.
  const p = s.players[me];
  p.deck.push(...p.hand.filter((u) => s.cards[u]!.defId === 't-dark'));
  p.hand = p.hand.filter((u) => s.cards[u]!.defId !== 't-dark');
  swapActiveTo(s, opp, 'sniper');
  attachFromDeck(s, opp, 't-dark');
  benchFromHand(s, opp, giveCard(s, opp, 't-basic'));
  return { s, me };
}

const legalFor = (s: GameState, me: PlayerId): Action[] => engine.getLegalActions(s, me);
const frozen = (o: HardOptions = {}): HardOptions => ({ now: () => 0, ...o });

describe('hard bot', () => {
  test('retreats an ex Pokémon the opponent can Knock Out next turn; Medium does not', () => {
    const { s, me } = threatened();
    const view = engine.viewFor(s, me);
    const legal = legalFor(s, me);
    const hard = createHardBot(registry, decks, me, frozen({ maxRounds: 2 }))(view, legal, 7);
    expect(hard.action.type).toBe('retreat');
    const medium = createMediumBot(registry, decks, me, 2)(view, legal, 7);
    expect(medium.action.type).not.toBe('retreat');
  });

  test('answers a promotion prompt for its own seat during the opponent reply', () => {
    // A plain Basic is on the Bench, so the Knockout in the reply raises a promotion prompt for Hard's seat.
    const { s, me } = threatened('t-basic');
    const scores: number[] = [];
    const out = createHardBot(
      registry,
      decks,
      me,
      frozen({ maxRounds: 1, onScore: (_a, v) => scores.push(v) }),
    )(engine.viewFor(s, me), legalFor(s, me), 3);
    expect(legalFor(s, me)).toContainEqual(out.action);
    // The search really ran: moves were scored, not skipped because the reply rollout threw or stalled.
    expect(scores.length).toBeGreaterThan(1);
    expect(scores.every((v) => v > -1e8)).toBe(true);
  });

  test('stops at maxRounds when the clock never moves', () => {
    const { s, me } = threatened();
    const rounds: number[] = [];
    createHardBot(
      registry,
      decks,
      me,
      frozen({ maxRounds: 3, onRound: (n) => rounds.push(n) }),
    )(engine.viewFor(s, me), legalFor(s, me), 5);
    expect(rounds).toEqual([1, 2, 3]);
  });

  test('stops after minRounds once the budget is spent', () => {
    const { s, me } = threatened();
    const rounds: number[] = [];
    let calls = 0;
    createHardBot(registry, decks, me, {
      budgetMs: 1500,
      minRounds: 2,
      now: () => (calls++ === 0 ? 0 : 10_000),
      onRound: (n) => rounds.push(n),
    })(engine.viewFor(s, me), legalFor(s, me), 5);
    expect(rounds).toEqual([1, 2]);
  });

  test('a budget spent before the first round still returns a legal action', () => {
    const { s, me } = threatened();
    let calls = 0;
    const legal = legalFor(s, me);
    const out = createHardBot(registry, decks, me, { now: () => (calls++ === 0 ? 0 : 1e9) })(
      engine.viewFor(s, me),
      legal,
      5,
    );
    expect(legal).toContainEqual(out.action);
  });

  test('same inputs and options give the same choice', () => {
    const { s, me } = threatened();
    const run = () =>
      createHardBot(registry, decks, me, frozen({ maxRounds: 2 }))(engine.viewFor(s, me), legalFor(s, me), 9);
    expect(run()).toEqual(run());
  });

  test('returns the only legal action without searching', () => {
    const { s, me } = threatened();
    const rounds: number[] = [];
    const only: Action[] = [{ type: 'endTurn' }];
    const out = createHardBot(
      registry,
      decks,
      me,
      frozen({ onRound: (n) => rounds.push(n) }),
    )(engine.viewFor(s, me), only, 5);
    expect(out.action).toEqual({ type: 'endTurn' });
    expect(rounds).toEqual([]);
  });

  test('takes an attack that wins the game', () => {
    // The opponent has one Pokémon with 10 HP left and an empty Bench: attacking ends the game.
    let s = started(engine, spec, spec, 11);
    s = act(engine, s, { type: 'endTurn' });
    const me = s.current;
    const opp: PlayerId = me === 0 ? 1 : 0;
    swapActiveTo(s, me, 'sniper');
    attachFromDeck(s, me, 't-dark');
    const target = s.players[opp].active!;
    target.damage = (registry.defs[s.cards[target.stack[0]!]!.defId] as { hp: number }).hp - 10;
    s.players[opp].bench = [];
    const mine = s.players[me];
    mine.deck.push(...mine.hand.filter((u) => s.cards[u]!.defId === 't-dark'));
    mine.hand = mine.hand.filter((u) => s.cards[u]!.defId !== 't-dark');
    const legal = legalFor(s, me);
    const out = createHardBot(registry, decks, me, frozen({ maxRounds: 1 }))(engine.viewFor(s, me), legal, 4);
    expect(out.action.type).toBe('attack');
  });

  test('promotes the bench Pokémon that can Knock Out the opponent, whatever the random seed', () => {
    // My Active (60 HP) is Knocked Out by the opponent's sniper (50 damage already on it). The Bench has a bare Basic
    // and a tank with 4 Energy, whose 100-damage attack would Knock the sniper out.
    let s = started(engine, spec, spec, 7);
    s = act(engine, s, { type: 'endTurn' });
    const me = s.current;
    const opp: PlayerId = me === 0 ? 1 : 0;
    swapActiveTo(s, me, 'spare');
    benchFromHand(s, me, giveCard(s, me, 't-basic'));
    benchFromHand(s, me, giveCard(s, me, 'tank'));
    for (let i = 0; i < 4; i++) attachFromDeck(s, me, 't-dark', 1);
    swapActiveTo(s, opp, 'sniper');
    attachFromDeck(s, opp, 't-dark');
    s.players[opp].active!.damage = 50;
    s = act(engine, s, { type: 'endTurn' });
    const easy = createEasyBot(registry);
    for (let i = 0; i < 60 && !(s.prompt && s.prompt.player === me); i++) {
      const p = s.prompt ? s.prompt.player : s.current;
      const r = easy(engine.viewFor(s, p), engine.getLegalActions(s, p), 100 + i);
      s = engine.applyAction(s, p, r.action).state;
    }
    expect(s.prompt?.message).toBe('Choose a new Active Pokémon');
    const view = engine.viewFor(s, me);
    const legal = legalFor(s, me);
    const tankOption = s.prompt!.options.find((o) => o.slot?.zone === 'bench' && o.slot.index === 1)!;
    for (let seed = 1; seed <= 8; seed++) {
      const out = createHardBot(registry, decks, me, frozen({ maxRounds: 2 }))(view, legal, seed);
      expect(out.action, `seed ${seed}`).toEqual({ type: 'answer', optionId: tankOption.id });
    }
  });

  test('falls back to the Easy policy when no move can be played in any guessed world', () => {
    const { s, me } = threatened();
    // Neither attack exists, so applying either throws in every guessed world; Easy picks the first of equals.
    const legal: Action[] = [
      { type: 'attack', attackIndex: 7 },
      { type: 'attack', attackIndex: 8 },
    ];
    for (let seed = 1; seed <= 8; seed++) {
      const out = createHardBot(
        registry,
        decks,
        me,
        frozen({ maxRounds: 1 }),
      )(engine.viewFor(s, me), legal, seed);
      expect(out.action, `seed ${seed}`).toEqual(legal[0]);
    }
  });
});
