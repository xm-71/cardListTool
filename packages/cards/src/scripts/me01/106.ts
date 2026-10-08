import type { CardScript } from '@ptcg/engine';
import { countHeads, inPlayRefs } from '../util.ts';

export const name = 'Miltank';
export const script: CardScript = {
  attacks: {
    // Bellyful of Milk: on two heads, heal all damage from 1 of your Pokémon.
    0: {
      effect(ctx) {
        if (countHeads(ctx, 2) < 2) return;
        const damaged = inPlayRefs(ctx, ctx.me).filter((ref) => ctx.slot(ref).damage > 0);
        if (damaged.length === 0) return;
        const [ref] = ctx.chooseSlot({
          player: ctx.me,
          among: damaged,
          min: 1,
          max: 1,
          message: 'Heal all damage from which Pokémon?',
        });
        ctx.heal(ref!, ctx.slot(ref!).damage);
      },
    },
  },
};
