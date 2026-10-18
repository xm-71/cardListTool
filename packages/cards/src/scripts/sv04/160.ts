import type { CardScript } from '@ptcg/engine';
import { benchRefs } from '../util.ts';

export const name = 'Counter Catcher';
export const script: CardScript = {
  trainer: {
    // Only while you have more Prize cards remaining than your opponent.
    canPlay: (ctx) =>
      ctx.state.players[ctx.me].prizes.length > ctx.state.players[ctx.opp].prizes.length &&
      ctx.state.players[ctx.opp].bench.length > 0,
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
