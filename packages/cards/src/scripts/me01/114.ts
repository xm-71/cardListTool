import type { CardScript } from '@ptcg/engine';
import { benchRefs } from '../util.ts';

export const name = "Boss's Orders";
export const script: CardScript = {
  trainer: {
    canPlay: (ctx) => ctx.state.players[ctx.opp].bench.length > 0,
    play(ctx) {
      const [ref] = ctx.chooseSlot({
        player: ctx.me,
        among: benchRefs(ctx, ctx.opp),
        min: 1,
        max: 1,
        message: "Choose one of your opponent's Benched Pokémon",
      });
      ctx.switchActive(ctx.opp, (ref as { index: number }).index);
    },
  },
};
