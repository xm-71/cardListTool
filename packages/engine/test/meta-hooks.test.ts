import { describe, expect, test } from 'vitest';
import type { CardDef, CardScript } from '../src/cards.ts';
import { dealAttackDamage, useAttackAs } from '../src/combat.ts';
import { createEngine } from '../src/engine.ts';
import { standard2026 } from '../src/ruleset.ts';
import { maxHp } from '../src/state.ts';
import type { GameState, PlayerId } from '../src/types.ts';
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

const energy = (id: string, provides: 'Psychic' | 'Darkness' = 'Darkness'): CardDef => ({
  id,
  name: id,
  category: 'Energy',
  energyKind: 'Special',
  provides: [provides],
  text: '',
  regulationMark: 'H',
  rarity: 'Common',
  image: '',
});
const trainer = (id: string, trainerType: 'Item' | 'Stadium' | 'Supporter'): CardDef => ({
  id,
  name: id,
  category: 'Trainer',
  trainerType,
  text: '',
  isAceSpec: false,
  regulationMark: 'H',
  rarity: 'Common',
  image: '',
});

const dragon = pokemon('dragon', { types: ['Dragon'], hp: 200, weakness: null });
const fairy = pokemon('fairy', { types: ['Psychic'], hp: 200 });
const meowth = pokemon('meowth', { hp: 100 });
const copier = pokemon('copier', { hp: 100 });
const psy = pokemon('psy', {
  types: ['Psychic'],
  hp: 100,
  attacks: [{ name: 'Psy Hit', cost: ['Colorless'], damage: 60, damageSuffix: '', text: '' }],
});
const big = pokemon('big', {
  hp: 100,
  attacks: [
    {
      name: 'Big Hit',
      cost: ['Colorless', 'Colorless', 'Colorless', 'Colorless'],
      damage: 150,
      damageSuffix: '',
      text: '',
    },
  ],
});

const scripts: Record<string, CardScript> = {
  draw4: { onAttachFromHand: (ctx) => void ctx.draw(ctx.me, 4) },
  hp20: { modifyMaxHp: (q) => q.hp + 20 },
  spiky: { afterDamagedInActive: (ctx, _h, attacker) => ctx.placeCounters(attacker, 2) },
  fairy: {
    modifyWeakness: (q) => {
      const def = q.registry.defs[q.state.cards[q.defenderTop]!.defId];
      return def?.category === 'Pokemon' && def.types.includes('Dragon') ? 'Psychic' : q.weakness;
    },
  },
  meowth: {
    onPlayToBench: {
      use(ctx) {
        ctx.draw(ctx.me, 1);
      },
    },
  },
  lockItems: { attacks: { 0: { effect: (ctx) => ctx.lockItems(ctx.opp) } } },
  cage: { stadium: { protectsBench: true } },
  counters: {
    attacks: { 0: { effect: (ctx) => ctx.placeCounters({ player: ctx.opp, zone: 'bench', index: 0 }, 3) } },
  },
  copier: {
    attacks: {
      0: {
        damage: () => 0,
        effect: (ctx) => {
          const benched = ctx.state.players[ctx.me].bench[0]!;
          useAttackAs(ctx, ctx.state.cards[benched.stack[0]!]!.defId, 0);
        },
      },
    },
  },
  item: { trainer: { play: () => {} } },
};
const defs = [
  dragon,
  fairy,
  meowth,
  copier,
  big,
  psy,
  energy('draw4'),
  energy('hp20'),
  energy('spiky'),
  pokemon('lockItems', {}),
  pokemon('counters', {}),
  trainer('cage', 'Stadium'),
  trainer('item', 'Item'),
];
const registry = miniRegistry(defs, scripts);
const engine = createEngine(registry);
const env = { registry, ruleset: standard2026 };
const spec = {
  't-basic': 10,
  dragon: 2,
  fairy: 2,
  meowth: 4,
  copier: 2,
  big: 2,
  psy: 2,
  draw4: 2,
  hp20: 2,
  spiky: 2,
  lockItems: 2,
  counters: 2,
  cage: 2,
  item: 4,
  't-dark': 20,
};

function turn2(): { s: GameState; me: PlayerId; opp: PlayerId } {
  let s = started(engine, spec, spec, 7);
  s = act(engine, s, { type: 'endTurn' });
  const me = s.current;
  return { s, me, opp: me === 0 ? 1 : 0 };
}

describe('hooks for the meta decks', () => {
  test('an Energy can react when attached from the hand', () => {
    const { s, me } = turn2();
    const uid = giveCard(s, me, 'draw4');
    const hand = s.players[me].hand.length;
    const next = act(engine, s, { type: 'attachEnergy', uid, target: { player: me, zone: 'active' } });
    expect(next.players[me].hand).toHaveLength(hand - 1 + 4);
  });

  test('an attached Energy can change max HP', () => {
    const { s, me } = turn2();
    const before = maxHp(env, s, { player: me, zone: 'active' });
    attachFromDeck(s, me, 'hp20');
    expect(maxHp(env, s, { player: me, zone: 'active' })).toBe(before + 20);
  });

  test('an attached Energy reacts when its Active Pokémon is damaged', () => {
    const { s, me, opp } = turn2();
    swapActiveTo(s, me, 'big');
    for (let i = 0; i < 4; i++) attachFromDeck(s, me, 't-dark');
    swapActiveTo(s, opp, 'dragon');
    attachFromDeck(s, opp, 'spiky');
    const next = act(engine, s, { type: 'attack', attackIndex: 0 });
    expect(next.players[me].active!.damage).toBe(20);
  });

  test("a Pokémon in play can change the Weakness of the opponent's Pokémon", () => {
    const hit = (withFairy: boolean) => {
      const { s, me, opp } = turn2();
      swapActiveTo(s, me, 'psy');
      attachFromDeck(s, me, 't-dark');
      if (withFairy) benchFromHand(s, me, giveCard(s, me, 'fairy'));
      swapActiveTo(s, opp, 'dragon');
      return act(engine, s, { type: 'attack', attackIndex: 0 }).players[opp].active!.damage;
    };
    expect(hit(false)).toBe(60);
    expect(hit(true)).toBe(120);
  });

  test('a Pokémon can react when played from the hand onto the Bench', () => {
    const { s, me } = turn2();
    const uid = s.players[me].hand.find((u) => s.cards[u]!.defId === 'meowth') ?? giveCard(s, me, 'meowth');
    const hand = s.players[me].hand.length;
    let next = act(engine, s, { type: 'playBasic', uid });
    expect(next.prompt?.kind).toBe('option');
    next = act(engine, next, { type: 'answer', optionId: 'yes' });
    expect(next.players[me].hand).toHaveLength(hand - 1 + 1);
  });

  test('locking Items stops the opponent playing Items during their next turn', () => {
    const { s, me, opp } = turn2();
    swapActiveTo(s, me, 'lockItems');
    attachFromDeck(s, me, 't-dark');
    giveCard(s, opp, 'item');
    const next = act(engine, s, { type: 'attack', attackIndex: 0 });
    expect(next.current).toBe(opp);
    expect(
      engine
        .getLegalActions(next, opp)
        .some((a) => a.type === 'playTrainer' && next.cards[a.uid]!.defId === 'item'),
    ).toBe(false);
  });

  test('a protecting Stadium stops damage counters on the Bench from the opponent', () => {
    const { s, me, opp } = turn2();
    swapActiveTo(s, me, 'counters');
    attachFromDeck(s, me, 't-dark');
    benchFromHand(s, opp, giveCard(s, opp, 't-basic'));
    const cage = giveCard(s, me, 'cage');
    let next = act(engine, s, { type: 'playTrainer', uid: cage });
    next = act(engine, next, { type: 'attack', attackIndex: 0 });
    expect(next.players[opp].bench[0]!.damage).toBe(0);
  });

  test("an attack can use another card's attack, without paying its cost", () => {
    const { s, me, opp } = turn2();
    swapActiveTo(s, me, 'copier');
    attachFromDeck(s, me, 't-dark');
    benchFromHand(s, me, giveCard(s, me, 'big'));
    swapActiveTo(s, opp, 'dragon');
    const next = act(engine, s, { type: 'attack', attackIndex: 0 });
    expect(next.players[opp].active!.damage).toBe(150);
    expect(typeof dealAttackDamage).toBe('function');
  });
});
