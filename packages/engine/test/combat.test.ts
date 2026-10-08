import { describe, expect, test } from 'vitest';
import type { CardScript } from '../src/cards.ts';
import { createEngine } from '../src/engine.ts';
import type { GameState, PlayerId } from '../src/types.ts';
import {
  act,
  attachFromDeck,
  benchFromHand,
  giveCard,
  has,
  miniRegistry,
  pokemon,
  started,
  swapActiveTo,
} from './fixtures.ts';

const fighter = pokemon('fighter', { types: ['Fighting'], hp: 100 });
const weak = pokemon('weak', { types: ['Darkness'], hp: 200, weakness: 'Fighting' });
const resist = pokemon('resist', { types: ['Psychic'], hp: 200, resistance: 'Fighting' });
const exMon = pokemon('exmon', { hp: 200, isEx: true });
const megaMon = pokemon('megamon', { hp: 300, isEx: true, isMega: true });
const booster = pokemon('booster', { types: ['Fighting'], hp: 100 });
const coated = pokemon('coated', { types: ['Darkness'], hp: 300, weakness: 'Fighting' });
const concealer = pokemon('concealer', { hp: 200, isEx: true });

const scripts: Record<string, CardScript> = {
  booster: {
    modifyOutgoingDamage: (q) =>
      q.holder.player === q.attacker.player && q.holder.zone === 'active' ? q.amount + 120 : q.amount,
  },
  coated: {
    modifyIncomingDamage: (q) =>
      q.holder.player === q.defender.player && q.holder.zone === q.defender.zone ? q.amount - 30 : q.amount,
  },
  concealer: { modifyPrizes: (q) => (q.holderSide === q.knockedOut.player ? q.prizes - 1 : q.prizes) },
};
const engine = createEngine(
  miniRegistry([fighter, weak, resist, exMon, megaMon, booster, coated, concealer], scripts),
);
const deck = {
  't-basic': 10,
  fighter: 2,
  weak: 2,
  resist: 2,
  exmon: 2,
  megamon: 2,
  booster: 2,
  coated: 2,
  concealer: 2,
  't-dark': 34,
};

/** A game on turn 2, where the second player (the attacker) is to act. */
function turn2(): { s: GameState; me: PlayerId; opp: PlayerId } {
  let s = started(engine, deck, deck, 5);
  s = act(engine, s, { type: 'endTurn' });
  const me = s.current;
  return { s, me, opp: me === 0 ? 1 : 0 };
}

function attackWith(
  attackerId: string,
  defenderId: string,
  setup?: (s: GameState, me: PlayerId, opp: PlayerId) => void,
) {
  const { s, me, opp } = turn2();
  swapActiveTo(s, me, attackerId);
  swapActiveTo(s, opp, defenderId);
  attachFromDeck(s, me, 't-dark');
  benchFromHand(s, opp, giveCard(s, opp, 't-basic'));
  setup?.(s, me, opp);
  return { s: act(engine, s, { type: 'attack', attackIndex: 0 }), me, opp };
}

describe('damage', () => {
  test('Weakness doubles damage', () => {
    const { s, opp } = attackWith('fighter', 'weak');
    expect(s.players[opp].active!.damage).toBe(40);
  });

  test('Resistance subtracts 30 and damage never goes below 0', () => {
    const { s, opp } = attackWith('fighter', 'resist');
    expect(s.players[opp].active!.damage).toBe(0);
  });

  test('outgoing modifiers apply before Weakness/Resistance and incoming ones after', () => {
    const { s, opp } = attackWith('booster', 'coated');
    expect(s.players[opp].active!.damage).toBe((20 + 120) * 2 - 30);
  });

  test('attacking ends the turn', () => {
    const { s, me } = attackWith('fighter', 'weak');
    expect(s.current).not.toBe(me);
  });
});

describe('knockouts and prizes', () => {
  const koPrizes = (defenderId: string) => {
    const { s, me } = attackWith('fighter', defenderId, (st, _me, opp) => {
      const d = st.players[opp].active!;
      d.damage =
        engine.registry.defs[defenderId]!.category === 'Pokemon'
          ? (engine.registry.defs[defenderId] as { hp: number }).hp - 10
          : 0;
    });
    return { s, taken: 6 - s.players[me].prizes.length, me };
  };

  test('a Knocked Out Pokémon gives 1 Prize, a Pokémon ex 2, a Mega Pokémon ex 3', () => {
    expect(koPrizes('t-basic').taken).toBe(1);
    expect(koPrizes('exmon').taken).toBe(2);
    expect(koPrizes('megamon').taken).toBe(3);
  });

  test('modifyPrizes can reduce the Prizes taken', () => {
    expect(koPrizes('concealer').taken).toBe(1);
  });

  test('the Knocked Out Pokémon and its attachments go to the discard pile', () => {
    const { s, opp } = attackWith('fighter', 't-basic', (st, _me, o) => {
      st.players[o].active!.damage = 50;
      attachFromDeck(st, o, 't-dark');
    });
    expect(s.players[opp].discard).toHaveLength(2);
  });

  test('after a Knockout the owner promotes a Benched Pokémon, then the turn passes', () => {
    const {
      s: before,
      me,
      opp,
    } = attackWith('fighter', 't-basic', (st, _m, o) => {
      st.players[o].active!.damage = 50;
      benchFromHand(st, o, giveCard(st, o, 't-basic'));
    });
    expect(before.prompt?.player).toBe(opp);
    expect(before.current).toBe(me);
    const s = act(engine, before, { type: 'answer', optionId: before.prompt!.options[0]!.id });
    expect(s.players[opp].active).not.toBeNull();
    expect(s.players[opp].bench).toHaveLength(1);
    expect(s.current).toBe(opp);
  });

  test('Knocking Out the last Pokémon in play wins the game', () => {
    const { s, me } = attackWith('fighter', 't-basic', (st, _m, o) => {
      st.players[o].active!.damage = 50;
      st.players[o].deck.push(...st.players[o].bench.splice(0).flatMap((b) => b.stack));
    });
    expect(s.result).toEqual({ winner: me, reason: 'noPokemon' });
  });

  test('taking the last Prize card wins the game', () => {
    const { s, me } = attackWith('fighter', 't-basic', (st, m, o) => {
      st.players[o].active!.damage = 50;
      st.players[m].deck.push(...st.players[m].prizes.splice(1));
    });
    expect(s.result).toEqual({ winner: me, reason: 'prizes' });
  });
});

describe('attack legality', () => {
  test('the first player cannot attack on turn 1; the second player can on turn 2', () => {
    let s = started(engine, deck, deck, 5);
    attachFromDeck(s, s.current, 't-dark');
    expect(has(engine.getLegalActions(s, s.current), 'attack')).toBe(false);
    s = act(engine, s, { type: 'endTurn' });
    attachFromDeck(s, s.current, 't-dark');
    expect(engine.getLegalActions(s, s.current)).toContainEqual({ type: 'attack', attackIndex: 0 });
  });

  test('an attack needs its Energy cost paid', () => {
    const { s } = turn2();
    expect(has(engine.getLegalActions(s, s.current), 'attack')).toBe(false);
  });
});
