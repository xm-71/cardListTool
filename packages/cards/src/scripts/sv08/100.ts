import type { CardScript } from '@ptcg/engine';

export const name = 'Annihilape';
export const set = 'sv08';
export const script: CardScript = {
  attacks: {
    // Tantrum: this Pokémon is now Confused.
    0: { effect: (ctx) => ctx.applyCondition({ player: ctx.me, zone: 'active' }, 'confused') },
    // Destined Fight: both Active Pokémon are Knocked Out.
    1: {
      effect(ctx) {
        ctx.knockOut({ player: ctx.opp, zone: 'active' });
        ctx.knockOut({ player: ctx.me, zone: 'active' });
      },
    },
  },
};
