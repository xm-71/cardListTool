import type { CardScript } from '@ptcg/engine';
import { benchRefs, discardOwnEnergy } from '../util.ts';

export const name = 'Mega Dragonite ex';
export const set = 'me02.5';
export const script: CardScript = {
  abilities: {
    // Sky Transport: once during your turn, switch your Active Pokémon with 1 of your Benched Pokémon.
    'Sky Transport': {
      canUse: (ctx) =>
        !ctx.usedAbilityNameThisTurn('Sky Transport') && ctx.state.players[ctx.me].bench.length > 0,
      use(ctx) {
        ctx.markAbilityName('Sky Transport');
        const [ref] = ctx.chooseSlot({
          player: ctx.me,
          among: benchRefs(ctx, ctx.me),
          min: 1,
          max: 1,
          message: 'Switch in which Benched Pokémon?',
        });
        ctx.switchActive(ctx.me, (ref as { index: number }).index);
      },
    },
  },
  attacks: {
    // Ryuno Glide: discard 2 Energy from this Pokémon.
    0: { effect: (ctx) => discardOwnEnergy(ctx, 2) },
  },
};
