import type { CardScript } from '@ptcg/engine';

export const name = 'Heracross';
export const set = 'sv06';
export const script: CardScript = {
  attacks: {
    // Body Slam: flip a coin. If heads, your opponent's Active Pokémon is now Paralyzed.
    0: {
      effect(ctx) {
        if (ctx.flipCoin()) ctx.applyCondition({ player: ctx.opp, zone: 'active' }, 'paralyzed');
      },
    },
  },
};
