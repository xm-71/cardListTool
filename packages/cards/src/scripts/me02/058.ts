import { dealAttackDamage, type CardScript } from '@ptcg/engine';
import { discardOwnEnergy, inPlayRefs } from '../util.ts';

export const name = 'Honchkrow';
export const set = 'me02';
export const script: CardScript = {
  attacks: {
    // Sniping Feathers: discard 2 Energy from this Pokémon; 120 damage to 1 of your opponent's Pokémon
    // (no Weakness or Resistance for Benched Pokémon).
    1: {
      damage(ctx) {
        discardOwnEnergy(ctx, 2);
        const [ref] = ctx.chooseSlot({
          player: ctx.me,
          among: inPlayRefs(ctx, ctx.opp),
          min: 1,
          max: 1,
          message: "Choose 1 of your opponent's Pokémon to do 120 damage to",
        });
        if (ref!.zone === 'active') return 120;
        dealAttackDamage(ctx, ref!, 120);
        return 0;
      },
    },
  },
};
