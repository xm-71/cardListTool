import { dealAttackDamage, type CardScript } from '@ptcg/engine';
import { benchRefs, topDef } from '../util.ts';

export const name = 'Shaymin';
export const set = 'sv05';
export const script: CardScript = {
  attacks: {
    // Pinpoint Dive: 60 damage to 1 of your opponent's Benched Pokémon ex.
    0: {
      effect(ctx) {
        const among = benchRefs(ctx, ctx.opp).filter((r) => topDef(ctx, r).isEx);
        if (among.length === 0) return;
        const [ref] = ctx.chooseSlot({
          player: ctx.me,
          among,
          min: 1,
          max: 1,
          message: 'Choose a Benched Pokémon ex',
        });
        dealAttackDamage(ctx, ref!, 60, { ignoreWeaknessResistance: true });
      },
    },
  },
};
