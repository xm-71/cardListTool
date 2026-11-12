import type { CardScript } from '@ptcg/engine';
import { isBasicEnergy, searchDeck } from '../util.ts';

export const name = 'Okidogi ex';
export const set = 'sv06.5';
export const script: CardScript = {
  attacks: {
    // Poisonous Musculature: search your deck for up to 2 Basic {D} Energy cards and attach them to this Pokémon, then
    // shuffle. If you attached Energy to a Pokémon in this way, this Pokémon is now Poisoned.
    0: {
      effect(ctx) {
        const self = { player: ctx.me, zone: 'active' } as const;
        const picks = searchDeck(ctx, {
          filter: (d) => isBasicEnergy(d, 'Darkness'),
          max: 2,
          message: 'Choose up to 2 Basic {D} Energy cards to attach to this Pokémon',
        });
        for (const uid of picks) ctx.attachEnergy(uid, self);
        ctx.shuffleDeck(ctx.me);
        if (picks.length > 0) ctx.applyCondition(self, 'poisoned');
      },
    },
    // Chain-Crazed: if this Pokémon is Poisoned, this attack does 130 more damage.
    1: {
      damage: (ctx) => (ctx.slot({ player: ctx.me, zone: 'active' }).conditions.poisoned ? 260 : 130),
    },
  },
};
