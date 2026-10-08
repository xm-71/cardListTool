import type { CardScript } from '@ptcg/engine';
import { benchRefs } from '../util.ts';

export const name = 'Switch';
export const script: CardScript = {
  trainer: {
    canPlay: (ctx) => ctx.state.players[ctx.me].bench.length > 0,
    play(ctx) {
      const [ref] = ctx.chooseSlot({
        player: ctx.me,
        among: benchRefs(ctx, ctx.me),
        min: 1,
        max: 1,
        message: 'Choose a Benched Pokémon to switch in',
      });
      ctx.switchActive(ctx.me, (ref as { index: number }).index);
    },
  },
};
