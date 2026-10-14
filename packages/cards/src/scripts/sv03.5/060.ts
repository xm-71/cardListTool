import type { CardScript } from '@ptcg/engine';

export const name = 'Poliwag';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Bubble: flip a coin. If heads, your opponent's Active Pokémon is now Paralyzed.
    0: {
      effect(ctx) {
        if (ctx.flipCoin()) ctx.applyCondition({ player: ctx.opp, zone: 'active' }, 'paralyzed');
      },
    },
  },
};
