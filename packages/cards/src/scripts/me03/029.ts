import type { CardScript, EffectCtx } from '@ptcg/engine';
import { inPlayRefs, isBasicEnergy, topDef } from '../util.ts';

const lightning = (ctx: EffectCtx) =>
  inPlayRefs(ctx, ctx.me).filter((r) => topDef(ctx, r).types.includes('Lightning'));

export const name = 'Dedenne';
export const set = 'me03';
export const script: CardScript = {
  attacks: {
    // Tail Generator: attach Basic {L} Energy from your discard, up to the Energy on all your opponent's Pokémon.
    0: {
      effect(ctx) {
        const limit = inPlayRefs(ctx, ctx.opp).reduce((n, r) => n + ctx.slot(r).energy.length, 0);
        const from = ctx.state.players[ctx.me].discard.filter((u) => isBasicEnergy(ctx.def(u), 'Lightning'));
        if (limit === 0 || from.length === 0 || lightning(ctx).length === 0) return;
        const picks = ctx.chooseCards({
          player: ctx.me,
          from,
          min: 0,
          max: limit,
          message: `Choose up to ${limit} Basic Lightning Energy`,
        });
        for (const uid of picks) {
          const [ref] = ctx.chooseSlot({
            player: ctx.me,
            among: lightning(ctx),
            min: 1,
            max: 1,
            message: 'Attach it to which Pokémon?',
          });
          ctx.attachEnergy(uid, ref!);
        }
      },
    },
    // Thunder Shock: flip a coin; if heads, your opponent's Active Pokémon is now Paralyzed.
    1: {
      effect(ctx) {
        if (ctx.flipCoin() && ctx.state.players[ctx.opp].active)
          ctx.applyCondition({ player: ctx.opp, zone: 'active' }, 'paralyzed');
      },
    },
  },
};
