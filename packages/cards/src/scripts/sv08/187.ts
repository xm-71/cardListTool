import type { CardScript } from '@ptcg/engine';
import { benchRefs } from '../util.ts';

export const name = 'Surfer';
export const script: CardScript = {
  trainer: {
    play(ctx) {
      if (ctx.state.players[ctx.me].bench.length === 0) return;
      const [ref] = ctx.chooseSlot({
        player: ctx.me,
        among: benchRefs(ctx, ctx.me),
        min: 1,
        max: 1,
        message: 'Choose a Benched Pokémon to switch in',
      });
      ctx.switchActive(ctx.me, (ref as { index: number }).index);
      ctx.draw(ctx.me, 5 - ctx.state.players[ctx.me].hand.length);
    },
  },
};
