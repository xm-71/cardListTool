import type { CardScript, EffectCtx } from '@ptcg/engine';
import { abilityHolder, energyOfType, inPlayRefs } from '../util.ts';

const damaged = (ctx: EffectCtx) => inPlayRefs(ctx, ctx.me).filter((ref) => ctx.slot(ref).damage > 0);

export const name = 'Munkidori';
export const set = 'sv06';
export const script: CardScript = {
  abilities: {
    // Adrena-Brain: with {D} Energy attached, move up to 3 damage counters from 1 of your Pokémon to 1 of theirs.
    'Adrena-Brain': {
      canUse: (ctx) =>
        energyOfType(ctx, abilityHolder(ctx), 'Darkness').length > 0 &&
        damaged(ctx).length > 0 &&
        inPlayRefs(ctx, ctx.opp).length > 0,
      use(ctx) {
        const [from] = ctx.chooseSlot({
          player: ctx.me,
          among: damaged(ctx),
          min: 1,
          max: 1,
          message: 'Move damage counters from which of your Pokémon?',
        });
        const [to] = ctx.chooseSlot({
          player: ctx.me,
          among: inPlayRefs(ctx, ctx.opp),
          min: 1,
          max: 1,
          message: "Move them to which of your opponent's Pokémon?",
        });
        const most = Math.min(3, ctx.slot(from!).damage / 10);
        const n = Number(
          ctx.chooseOption({
            player: ctx.me,
            options: Array.from({ length: most }, (_, i) => ({ id: String(i + 1), label: `${i + 1}` })),
            message: 'How many damage counters?',
          }),
        );
        ctx.heal(from!, n * 10);
        ctx.placeCounters(to!, n);
      },
    },
  },
  attacks: {
    // Mind Bend: your opponent's Active Pokémon is now Confused.
    0: { effect: (ctx) => ctx.applyCondition({ player: ctx.opp, zone: 'active' }, 'confused') },
  },
};
