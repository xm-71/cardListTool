import type { CardScript } from '@ptcg/engine';

export const name = 'Poliwrath';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Bubble Beam: flip a coin. If heads, your opponent's Active Pokémon is now Paralyzed.
    0: {
      effect(ctx) {
        if (ctx.flipCoin()) ctx.applyCondition({ player: ctx.opp, zone: 'active' }, 'paralyzed');
      },
    },
    // Heroic Punch: flip a coin. If heads, this attack does 150 more damage.
    1: { damage: (ctx) => (ctx.flipCoin() ? 250 : 100) },
  },
};
