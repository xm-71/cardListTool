import type { CardScript } from '@ptcg/engine';
import { isBasicEnergy } from '../util.ts';

export const name = 'Arcanine';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Torrid Torrent: attach up to 2 Basic {R} Energy from your discard pile to this Pokémon.
    0: {
      effect(ctx) {
        const from = ctx.state.players[ctx.me].discard.filter((uid) => isBasicEnergy(ctx.def(uid), 'Fire'));
        const picks = ctx.chooseCards({
          player: ctx.me,
          from,
          min: 0,
          max: 2,
          message: 'Choose up to 2 Basic {R} Energy to attach',
        });
        for (const uid of picks) ctx.attachEnergy(uid, { player: ctx.me, zone: 'active' });
      },
    },
    // Dynamite Fang: discard 2 {R} Energy from this Pokémon.
    1: {
      effect(ctx) {
        const ref = { player: ctx.me, zone: 'active' } as const;
        const fire = ctx.slot(ref).energy.filter((uid) => {
          const d = ctx.def(uid);
          return d.category === 'Energy' && d.provides.includes('Fire');
        });
        const n = Math.min(2, fire.length);
        if (n === 0) return;
        const picks = ctx.chooseCards({
          player: ctx.me,
          from: fire,
          min: n,
          max: n,
          message: 'Discard 2 {R} Energy from this Pokémon',
        });
        ctx.discardEnergy(ref, picks);
      },
    },
  },
};
