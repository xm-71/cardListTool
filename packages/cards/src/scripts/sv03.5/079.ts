import type { CardScript } from '@ptcg/engine';

export const name = 'Slowpoke';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Sea Bathing: heal 30 damage from this Pokémon, and it recovers from all Special Conditions.
    0: {
      effect(ctx) {
        const ref = { player: ctx.me, zone: 'active' } as const;
        ctx.heal(ref, 30);
        ctx.slot(ref).conditions = { rotation: 'none', poisoned: false, burned: false };
      },
    },
  },
};
