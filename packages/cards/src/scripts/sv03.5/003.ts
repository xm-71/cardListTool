import type { CardScript } from '@ptcg/engine';
import { abilityHolder, inPlayRefs } from '../util.ts';

const damaged = (ctx: Parameters<NonNullable<CardScript['abilities']>[string]['use']>[0]) =>
  inPlayRefs(ctx, ctx.me).filter((ref) => ctx.slot(ref).damage > 0);

export const name = 'Venusaur ex';
export const set = 'sv03.5';
export const script: CardScript = {
  abilities: {
    // Tranquil Flower: once during your turn, if this Pokémon is in the Active Spot, heal 60 damage from 1 of your Pokémon.
    'Tranquil Flower': {
      canUse: (ctx) => abilityHolder(ctx).zone === 'active' && damaged(ctx).length > 0,
      use(ctx) {
        const [ref] = ctx.chooseSlot({
          player: ctx.me,
          among: damaged(ctx),
          min: 1,
          max: 1,
          message: 'Heal 60 damage from which Pokémon?',
        });
        ctx.heal(ref!, 60);
      },
    },
  },
  attacks: {
    // Dangerous Toxwhip: the Defending Pokémon is now Confused and Poisoned.
    0: {
      effect(ctx) {
        ctx.applyCondition({ player: ctx.opp, zone: 'active' }, 'confused');
        ctx.applyCondition({ player: ctx.opp, zone: 'active' }, 'poisoned');
      },
    },
  },
};
