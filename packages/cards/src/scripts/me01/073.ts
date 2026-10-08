import type { CardScript } from '@ptcg/engine';
import { benchRefs } from '../util.ts';

export const name = 'Hariyama';
export const script: CardScript = {
  // Heave-Ho Catcher
  onEvolveFromHand: {
    use(ctx) {
      if (ctx.state.players[ctx.opp].bench.length === 0) return;
      const [ref] = ctx.chooseSlot({
        player: ctx.me,
        among: benchRefs(ctx, ctx.opp),
        min: 1,
        max: 1,
        message: "Choose one of your opponent's Benched Pokémon to switch in",
      });
      ctx.switchActive(ctx.opp, (ref as { index: number }).index);
    },
  },
  attacks: {
    // Wild Press
    0: { effect: (ctx) => ctx.damageSelf(70) },
  },
};
