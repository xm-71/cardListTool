import type { CardScript } from '@ptcg/engine';
import { countHeads } from '../util.ts';

export const name = 'Klawf';
export const set = 'sv09';
export const script: CardScript = {
  attacks: {
    // Snipping Pincers: flip 2 coins. For each heads, discard an Energy from your opponent's Active Pokémon.
    0: {
      effect(ctx) {
        const ref = { player: ctx.opp, zone: 'active' } as const;
        const slot = ctx.state.players[ctx.opp].active;
        if (!slot) return;
        const n = Math.min(countHeads(ctx, 2), slot.energy.length);
        if (n === 0) return;
        const picks = ctx.chooseCards({
          player: ctx.me,
          from: [...slot.energy],
          min: n,
          max: n,
          message: `Choose ${n} Energy to discard from your opponent's Active Pokémon`,
        });
        ctx.discardEnergy(ref, picks);
      },
    },
  },
};
