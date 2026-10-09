import type { CardScript } from '@ptcg/engine';
import { inPlayRefs } from '../util.ts';

export const name = 'Electrode';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Bang Boom Chain: discard any number of your Pokémon Tools first; 40 more for each.
    0: {
      damage(ctx) {
        const tools = inPlayRefs(ctx, ctx.me).flatMap((ref) => {
          const uid = ctx.slot(ref).tool;
          return uid ? [{ ref, uid }] : [];
        });
        if (tools.length === 0) return 20;
        const picks = ctx.chooseCards({
          player: ctx.me,
          from: tools.map((t) => t.uid),
          min: 0,
          max: tools.length,
          message: 'Discard any number of Pokémon Tools (40 more damage each)',
        });
        for (const uid of picks) {
          ctx.slot(tools.find((t) => t.uid === uid)!.ref).tool = null;
          ctx.state.players[ctx.me].discard.push(uid);
        }
        if (picks.length > 0) ctx.log(`${picks.length} Pokémon Tool(s) are discarded`);
        return 20 + 40 * picks.length;
      },
    },
  },
};
