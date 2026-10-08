import type { CardScript } from '@ptcg/engine';
import { benchRefs, defAt, refsOf, sameRef } from '../util.ts';

export const name = 'Mega Gengar ex';
export const script: CardScript = {
  // Shadowy Concealment
  modifyPrizes(q) {
    if (!q.byAttackFromEx || q.knockedOut.player !== q.holderSide) return q.prizes;
    if (!defAt(q.state, q.registry, q.knockedOut)?.types.includes('Darkness')) return q.prizes;
    // Doesn't stack: only the first Mega Gengar ex in play on this side applies.
    const first = refsOf(q.state, q.holderSide).find((r) => defAt(q.state, q.registry, r)?.name === name);
    return first && sameRef(first, q.holder) ? q.prizes - 1 : q.prizes;
  },
  attacks: {
    // Void Gale
    0: {
      effect(ctx) {
        const self = { player: ctx.me, zone: 'active' } as const;
        const energy = ctx.slot(self).energy;
        if (energy.length === 0 || ctx.state.players[ctx.me].bench.length === 0) return;
        const [uid] = ctx.chooseCards({
          player: ctx.me,
          from: [...energy],
          min: 1,
          max: 1,
          message: 'Choose an Energy to move',
        });
        const [to] = ctx.chooseSlot({
          player: ctx.me,
          among: benchRefs(ctx, ctx.me),
          min: 1,
          max: 1,
          message: 'Choose a Benched Pokémon to move it to',
        });
        ctx.detachEnergy(self, [uid!], 'hand');
        ctx.attachEnergy(uid!, to!);
      },
    },
  },
};
