import type { CardScript } from '@ptcg/engine';

export const name = 'Pidgeot';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Fly: flip a coin. If tails, this attack does nothing. If heads, during your opponent's next turn, prevent all
    // damage from and effects of attacks done to this Pokémon.
    1: {
      damage(ctx) {
        if (!ctx.flipCoin()) return 0;
        ctx.addMarker({ player: ctx.me, zone: 'active' }, 'preventDamage');
        ctx.addMarker({ player: ctx.me, zone: 'active' }, 'preventEffects');
        return 150;
      },
    },
  },
};
