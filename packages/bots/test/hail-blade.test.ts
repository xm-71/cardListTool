import { describe, expect, test } from 'vitest';
import { createEngine, type Action, type GameState, type PlayerId } from '@ptcg/engine';
import { attachFromDeck, benchFromHand, finishSetup, giveCard, swapActiveTo } from '@ptcg/engine/testing';
import * as cards from '@ptcg/cards';
import { createSmartBot } from '../src/smart.ts';

const registry = cards.buildRegistry();
const engine = createEngine(registry);
const lorelei = cards.GYM_DECKS.lorelei!;
const agatha = cards.GYM_DECKS.agatha!;
const bot = createSmartBot(registry, [lorelei, agatha]);

const CHIEN_PAO = 'sv02-061';
const FRIGIBAX = 'sv02-057';
const MUNKIDORI = 'sv06-095'; // 110 HP, no Weakness to Water
const WATER = 'mee-003';

/** Lorelei's turn with Chien-Pao ex Active and `active` Water Energy on it. */
function setup(active: number, bench = 0): { s: GameState; me: PlayerId; opp: PlayerId } {
  for (let seed = 3; ; seed++) {
    let s = finishSetup(engine, engine.createGame({ decks: [lorelei, agatha], seed }));
    if (s.first !== 0) continue;
    for (let i = 0; i < 2; i++) s = engine.applyAction(s, s.current, { type: 'endTurn' }).state;
    swapActiveTo(s, 0, CHIEN_PAO);
    for (let i = 0; i < active; i++) attachFromDeck(s, 0, WATER);
    if (bench > 0) {
      benchFromHand(s, 0, giveCard(s, 0, FRIGIBAX));
      for (let i = 0; i < bench; i++) {
        const uid = s.players[0].deck.find((u) => s.cards[u]!.defId === WATER)!;
        s.players[0].deck.splice(s.players[0].deck.indexOf(uid), 1);
        s.players[0].bench[s.players[0].bench.length - 1]!.energy.push(uid);
      }
    }
    swapActiveTo(s, 1, MUNKIDORI);
    return { s, me: 0, opp: 1 };
  }
}

/** Hail Blade, with every card prompt answered by the smart bot. */
function hailBlade(s0: GameState): GameState {
  let s = engine.applyAction(s0, 0, { type: 'attack', attackIndex: 0 }).state;
  for (let guard = 0; s.prompt && guard < 30; guard++) {
    const legal = engine.getLegalActions(s, s.prompt.player);
    const action: Action = bot(engine.viewFor(s, s.prompt.player), legal, 5).action;
    s = engine.applyAction(s, s.prompt.player, action).state;
  }
  return s;
}

describe('Hail Blade (discard any amount of {W} Energy, 60 damage each)', () => {
  test('discards just enough Energy to Knock Out the Defending Pokémon', () => {
    const { s: s0 } = setup(5);
    const s = hailBlade(s0);
    expect(s.players[1].active?.stack.length ?? 0).toBe(0); // 110 HP: 2 Energy (120) is enough
    expect(s.players[0].active!.energy).toHaveLength(3);
  });

  test('takes the Energy from the Active before the Bench', () => {
    const { s: s0 } = setup(3, 2);
    const s = hailBlade(s0);
    expect(s.players[0].bench[0]!.energy).toHaveLength(2);
  });

  test('when it cannot Knock Out, keeps what the Active needs to attack again', () => {
    const { s: s0 } = setup(4, 2);
    s0.players[1].active!.damage = -400; // far too much HP to take in one attack
    const s = hailBlade(s0);
    expect(s.players[0].active!.energy).toHaveLength(2); // Hail Blade costs WW: those stay
    expect(s.players[0].bench[0]!.energy).toHaveLength(2); // the Bench is left alone
    expect(s.players[1].active!.damage).toBe(-400 + 120);
  });

  test('counts the Defending Pokémon’s Resistance when working out how many to discard', () => {
    const resists = Object.values(registry.defs).find(
      (d) => d.category === 'Pokemon' && d.stage === 'Basic' && d.resistance === 'Water' && d.hp >= 130,
    )!;
    const { s: s0 } = setup(5);
    const opp = s0.players[1].active!;
    s0.cards[opp.stack[0]!]!.defId = resists.id;
    opp.damage = (resists as { hp: number }).hp - 120; // 120 left: 2 Energy would do, but Resistance takes 30 off
    const s = hailBlade(s0);
    expect(s.players[1].active?.stack.length ?? 0).toBe(0); // knocked out
    expect(s.players[0].active!.energy).toHaveLength(2); // 3 discarded: 180 - 30 = 150
  });

  test('does not count Energy the prompt’s maximum will not let it discard', () => {
    const { s: s0 } = setup(2, 3);
    s0.players[1].active!.damage = -190; // 300 left: five Energy in total could do it, but only two may be chosen
    let s = engine.applyAction(s0, 0, { type: 'attack', attackIndex: 0 }).state;
    const prompt = { ...s.prompt!, max: 2 };
    const view = { ...engine.viewFor(s, 0), prompt };
    const answer = bot(view, engine.getLegalActions(s, 0), 5).action;
    expect(answer).toEqual({ type: 'answer', optionId: 'done' }); // the Active keeps the Energy it attacks with
    s = engine.applyAction(s, 0, answer).state;
  });
});
