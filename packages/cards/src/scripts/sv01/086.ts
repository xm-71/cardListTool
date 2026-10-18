import type { CardScript, EffectCtx } from '@ptcg/engine';
import { maxHp } from '@ptcg/engine';
import { inPlayRefs, isBasicEnergy, topDef } from '../util.ts';

/** Psychic Pokémon that would survive 2 more damage counters. */
const targets = (ctx: EffectCtx) =>
  inPlayRefs(ctx, ctx.me).filter(
    (ref) =>
      topDef(ctx, ref).types.includes('Psychic') &&
      ctx.slot(ref).damage + 20 < maxHp(ctx.env, ctx.state, ref),
  );
const energyInDiscard = (ctx: EffectCtx) =>
  ctx.state.players[ctx.me].discard.filter((u) => isBasicEnergy(ctx.def(u), 'Psychic'));

export const name = 'Gardevoir ex';
export const script: CardScript = {
  abilities: {
    // Psychic Embrace: as often as you like, attach a Basic {P} Energy from the discard pile to 1 of your {P} Pokémon,
    // then put 2 damage counters on it (not on a Pokémon that would be Knocked Out).
    'Psychic Embrace': {
      repeatable: true,
      canUse: (ctx) => energyInDiscard(ctx).length > 0 && targets(ctx).length > 0,
      use(ctx) {
        const [uid] = ctx.chooseCards({
          player: ctx.me,
          from: energyInDiscard(ctx),
          min: 1,
          max: 1,
          message: 'Choose a Basic {P} Energy from your discard pile',
        });
        const [ref] = ctx.chooseSlot({
          player: ctx.me,
          among: targets(ctx),
          min: 1,
          max: 1,
          message: 'Attach it to which {P} Pokémon?',
        });
        if (!uid || !ref) return;
        ctx.attachEnergy(uid, ref);
        ctx.placeCounters(ref, 2);
      },
    },
  },
  attacks: {
    // Miracle Force: this Pokémon recovers from all Special Conditions.
    0: {
      effect(ctx) {
        ctx.slot({ player: ctx.me, zone: 'active' }).conditions = {
          rotation: 'none',
          poisoned: false,
          burned: false,
        };
      },
    },
  },
};
