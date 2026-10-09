import { describe, expect, test } from 'vitest';
import type { CardDef, CardScript } from '../src/cards.ts';
import { createEngine } from '../src/engine.ts';
import { getRetreatCost } from '../src/energy.ts';
import type { EffectCtx } from '../src/effects.ts';
import type { Action, GameState, PlayerId, SlotRef } from '../src/types.ts';
import {
  act,
  attachFromDeck,
  benchFromHand,
  giveCard,
  miniRegistry,
  pokemon,
  started,
  swapActiveTo,
} from './fixtures.ts';

const atk = (name: string, damage: number) => ({
  name,
  cost: ['Colorless' as const],
  damage,
  damageSuffix: '' as const,
  text: 'x',
});
const ability = (name: string) => ({ name, text: 'x' });
const selfRef = (ctx: EffectCtx): SlotRef => (ctx.source as { slot: SlotRef }).slot;
const zoneOf = (r: SlotRef) => (r.zone === 'active' ? 'active' : `bench${r.index}`);

const defs: CardDef[] = [
  pokemon('hitter', { hp: 300, attacks: [atk('Hit', 60)] }),
  pokemon('frail', { hp: 50 }),
  pokemon('guts', { hp: 50 }),
  pokemon('immune', { hp: 50 }),
  pokemon('weez', { hp: 50 }),
  pokemon('weezko', { hp: 50 }),
  pokemon('drag', { hp: 300 }),
  pokemon('forced', { hp: 300, stage: 'Stage1', evolvesFrom: 'hitter' }),
  pokemon('asked', { hp: 300, stage: 'Stage1', evolvesFrom: 'hitter' }),
  pokemon('dispo', { hp: 300, abilities: [ability('Pop')] }),
  pokemon('sniper', { hp: 300, abilities: [ability('Snipe')] }),
];
const scripts: Record<string, CardScript> = {
  guts: { survivesKnockout: (ctx) => ctx.flipCoin() },
  immune: { survivesKnockout: () => true },
  weez: {
    afterKnockout: (ctx, e) => ctx.log(`weez holder=${zoneOf(e.holder)} knocked=${zoneOf(e.knocked)}`),
  },
  weezko: {
    afterKnockout: (ctx, e) => {
      if (e.holder.zone === 'active') ctx.slot(e.attacker).damage = 9999;
    },
  },
  drag: { modifyAllRetreatCosts: (q) => q.cost - 1 },
  forced: { onEvolveFromHand: { mandatory: true, use: (ctx) => ctx.log('forced ran') } },
  asked: { onEvolveFromHand: { use: (ctx) => ctx.log('asked ran') } },
  dispo: { abilities: { Pop: { canUse: () => true, use: (ctx) => ctx.discardSlot(selfRef(ctx)) } } },
  sniper: {
    abilities: {
      Snipe: { canUse: () => true, use: (ctx) => ctx.placeCounters({ player: ctx.opp, zone: 'active' }, 99) },
    },
  },
};
const engine = createEngine(miniRegistry(defs, scripts));
const each = Object.fromEntries(defs.map((d) => [d.id, 2]));
const deck = { ...each, 't-basic': 6, 't-dark': 32 };

/** Turn 2: `me` to act with both Actives holding one Darkness Energy and both sides having a Benched Basic. */
function setup(mine: string, theirs: string, seed = 4): { s: GameState; me: PlayerId; opp: PlayerId } {
  let s = started(engine, deck, deck, seed);
  s = act(engine, s, { type: 'endTurn' });
  const me = s.current;
  const opp: PlayerId = me === 0 ? 1 : 0;
  swapActiveTo(s, me, mine);
  swapActiveTo(s, opp, theirs);
  attachFromDeck(s, me, 't-dark');
  attachFromDeck(s, opp, 't-dark');
  benchFromHand(s, me, giveCard(s, me, 't-basic'));
  benchFromHand(s, opp, giveCard(s, opp, 't-basic'));
  return { s, me, opp };
}
/** A card of `defId` in the player's hand: one already there, or one moved in from the deck. */
const need = (s: GameState, p: PlayerId, defId: string) =>
  s.players[p].hand.find((u) => s.cards[u]!.defId === defId) ?? giveCard(s, p, defId);
const attack = (s: GameState) => act(engine, s, { type: 'attack', attackIndex: 0 });
const endTurn = (s: GameState) => act(engine, s, { type: 'endTurn' });
const heads = (s: GameState, from: number) => s.log.slice(from).some((e) => e.text === 'Coin flip: heads');
const logged = (s: GameState, text: string) =>
  s.log.filter((e) => e.text.startsWith(text)).map((e) => e.text);
const answerFirst = (s: GameState) => act(engine, s, { type: 'answer', optionId: s.prompt!.options[0]!.id });

describe('survivesKnockout', () => {
  test('Guts: on heads the Pokémon survives lethal attack damage with 10 HP left, on tails it is Knocked Out', () => {
    const seen = new Set<boolean>();
    for (let seed = 1; seed <= 20 && seen.size < 2; seed++) {
      const { s: s0, opp } = setup('hitter', 'guts', seed);
      const s = attack(s0);
      const flipped = heads(s, s0.log.length);
      seen.add(flipped);
      if (flipped) {
        expect(s.players[opp].active!.damage).toBe(40);
        expect(s.players[s0.current].prizes).toHaveLength(6);
      } else {
        expect(s.players[s0.current].prizes).toHaveLength(5);
      }
    }
    expect(seen.size).toBe(2);
  });

  test('a Pokémon that always survives still falls to Poison from Pokémon Checkup', () => {
    const { s: s0, me, opp } = setup('hitter', 'immune');
    s0.players[opp].active!.damage = 40;
    s0.players[opp].active!.conditions.poisoned = true;
    const s = endTurn(s0); // checkup: 10 Poison damage
    expect(s.players[me].prizes).toHaveLength(5);
    expect(s.players[opp].discard.length).toBeGreaterThan(0);
  });

  test('a hook that always survives keeps the Pokémon alive against an attack', () => {
    const { s: s0, opp } = setup('hitter', 'immune');
    const s = attack(s0);
    expect(s.players[opp].active!.damage).toBe(40);
  });

  test('without the hook, lethal attack damage Knocks the Pokémon Out', () => {
    const { s: s0, me } = setup('hitter', 'frail');
    expect(attack(s0).players[me].prizes).toHaveLength(5);
  });
});

describe('afterKnockout', () => {
  test('runs for each of the Knocked Out Pokémon’s owner’s Pokémon with the hook, not the attacker’s side', () => {
    const { s: s0, me, opp } = setup('hitter', 'weez');
    benchFromHand(s0, opp, need(s0, opp, 'weez'));
    benchFromHand(s0, me, need(s0, me, 'weez'));
    const s = attack(s0);
    expect(logged(s, 'weez holder=')).toEqual([
      'weez holder=active knocked=active',
      'weez holder=bench1 knocked=active',
    ]);
  });

  test('does not run for a Knock Out by Poison', () => {
    const { s: s0, opp } = setup('hitter', 'weez');
    s0.players[opp].active!.damage = 45;
    s0.players[opp].active!.conditions.poisoned = true;
    const s = endTurn(s0);
    expect(logged(s, 'weez holder=')).toEqual([]);
  });

  test('a reaction can Knock the attacker Out, with Prizes for both', () => {
    const { s: s0, me, opp } = setup('hitter', 'weezko');
    const s = attack(s0);
    expect(s.players[me].prizes).toHaveLength(5); // I took the weezko
    expect(s.players[opp].prizes).toHaveLength(5); // the opponent took my attacker
  });
});

describe('modifyAllRetreatCosts', () => {
  test('a Benched Pokémon lowers the Retreat Cost of its owner’s Pokémon, not the opponent’s', () => {
    const { s, me, opp } = setup('hitter', 'hitter');
    const mine = { player: me, zone: 'active' } as const;
    const theirs = { player: opp, zone: 'active' } as const;
    expect(getRetreatCost(s, mine, engine.registry)).toBe(1);
    benchFromHand(s, me, need(s, me, 'drag'));
    expect(getRetreatCost(s, mine, engine.registry)).toBe(0);
    expect(getRetreatCost(s, theirs, engine.registry)).toBe(1);
  });
});

describe('forced evolve Abilities', () => {
  const evolveInto = (name: string) => {
    const { s: s0, me } = setup('hitter', 'hitter');
    const s1 = endTurn(endTurn(s0)); // so evolving is allowed
    const uid = need(s1, me, name);
    return act(engine, s1, { type: 'evolve', uid, target: { player: me, zone: 'active' } });
  };
  test('a mandatory one runs without a question', () => {
    const s = evolveInto('forced');
    expect(s.prompt).toBeNull();
    expect(logged(s, 'forced ran')).toHaveLength(1);
  });
  test('an optional one still asks first', () => {
    const s = evolveInto('asked');
    expect(s.prompt?.message).toBe("Use asked's Ability?");
    expect(logged(s, 'asked ran')).toHaveLength(0);
  });
});

describe('discardSlot and Abilities', () => {
  const pop = (me: PlayerId, index: number | 'active'): Action => ({
    type: 'useAbility',
    slot: index === 'active' ? { player: me, zone: 'active' } : { player: me, zone: 'bench', index },
    ability: 'Pop',
  });

  test('a Benched Pokémon goes to the discard pile with its Energy and the Bench closes up', () => {
    const { s: s0, me } = setup('hitter', 'hitter');
    benchFromHand(s0, me, need(s0, me, 'dispo'));
    attachFromDeck(s0, me, 't-dark', 1);
    const discard = s0.players[me].discard.length;
    const s = act(engine, s0, pop(me, 1));
    expect(s.players[me].bench).toHaveLength(1);
    expect(s.players[me].discard.length).toBe(discard + 2); // the Pokémon and its Energy
  });

  test('discarding the Active Pokémon asks for a new Active when there is a choice, then play goes on', () => {
    const { s: s0, me } = setup('dispo', 'hitter');
    benchFromHand(s0, me, need(s0, me, 't-basic'));
    let s = act(engine, s0, pop(me, 'active'));
    expect(s.prompt?.player).toBe(me);
    expect(s.prompt?.message).toBe('Choose a new Active Pokémon');
    s = answerFirst(s);
    expect(s.prompt).toBeNull();
    expect(s.players[me].active).not.toBeNull();
    expect(s.players[me].bench).toHaveLength(1);
    expect(s.players[me].prizes).toHaveLength(6);
    expect(s.result).toBeNull();
  });

  test('with a single Benched Pokémon it is promoted without a question', () => {
    const { s: s0, me } = setup('dispo', 'hitter');
    const s = act(engine, s0, pop(me, 'active'));
    expect(s.prompt).toBeNull();
    expect(s.players[me].active).not.toBeNull();
    expect(s.players[me].bench).toHaveLength(0);
  });

  test('discarding your only Pokémon in play loses the game', () => {
    const { s: s0, me, opp } = setup('dispo', 'hitter');
    s0.players[me].bench = [];
    const s = act(engine, s0, pop(me, 'active'));
    expect(s.result?.winner).toBe(opp);
  });

  test('damage counters from an Ability can Knock Out, and Prizes are taken', () => {
    const { s: s0, me, opp } = setup('sniper', 'frail');
    let s = act(engine, s0, {
      type: 'useAbility',
      slot: { player: me, zone: 'active' },
      ability: 'Snipe',
    });
    s = s.prompt ? answerFirst(s) : s;
    expect(s.players[me].prizes).toHaveLength(5);
    expect(s.players[opp].active?.stack[0]).not.toBe(undefined);
  });
});
