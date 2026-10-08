import type { CardScript } from '@ptcg/engine';
import { benchRefs, isBasicEnergy } from '../util.ts';

export const name = 'Mega Lucario ex';
export const script: CardScript = {
  attacks: {
    // Aura Jab: attach up to 3 Basic {F} Energy from the discard pile to Benched Pokémon, one at a time.
    0: {
      effect(ctx) {
        for (let i = 0; i < 3 && ctx.state.players[ctx.me].bench.length > 0; i++) {
          const energy = ctx.state.players[ctx.me].discard.filter((u) =>
            isBasicEnergy(ctx.def(u), 'Fighting'),
          );
          const [uid] = ctx.chooseCards({
            player: ctx.me,
            from: energy,
            min: 0,
            max: 1,
            message: 'Attach a Basic {F} Energy (or finish)',
          });
          if (!uid) break;
          const [ref] = ctx.chooseSlot({
            player: ctx.me,
            among: benchRefs(ctx, ctx.me),
            min: 1,
            max: 1,
            message: 'To which Benched Pokémon?',
          });
          ctx.attachEnergy(uid, ref!);
        }
      },
    },
    // Mega Brave
    1: { effect: (ctx) => ctx.lockAttack({ player: ctx.me, zone: 'active' }, 'Mega Brave') },
  },
};
