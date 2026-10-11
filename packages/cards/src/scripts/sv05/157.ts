import type { CardScript } from '@ptcg/engine';
import { benchRefs } from '../util.ts';

export const name = 'Prime Catcher';
export const script: CardScript = {
  // Switch in 1 of your opponent's Benched Pokémon; if you do, switch your Active with 1 of your Benched Pokémon.
  trainer: {
    canPlay: (ctx) => ctx.state.players[ctx.opp].bench.length > 0,
    play(ctx) {
      const [theirs] = ctx.chooseSlot({
        player: ctx.me,
        among: benchRefs(ctx, ctx.opp),
        min: 1,
        max: 1,
        message: "Choose 1 of your opponent's Benched Pokémon",
      });
      ctx.switchActive(ctx.opp, (theirs as { index: number }).index);
      const mine = benchRefs(ctx, ctx.me);
      if (mine.length === 0 || !ctx.state.players[ctx.me].active) return;
      const [ref] = ctx.chooseSlot({
        player: ctx.me,
        among: mine,
        min: 1,
        max: 1,
        message: 'Switch your Active Pokémon with which Benched Pokémon?',
      });
      ctx.switchActive(ctx.me, (ref as { index: number }).index);
    },
  },
};
