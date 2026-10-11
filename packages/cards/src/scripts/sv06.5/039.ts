import type { CardScript, EffectCtx } from '@ptcg/engine';
import { benchRefs, topDef } from '../util.ts';

const darkBench = (ctx: EffectCtx) =>
  benchRefs(ctx, ctx.me).filter((r) => {
    const d = topDef(ctx, r);
    return d.types.includes('Darkness') && d.name !== 'Pecharunt ex';
  });

export const name = 'Pecharunt ex';
export const set = 'sv06.5';
export const script: CardScript = {
  abilities: {
    // Subjugating Chains: switch 1 of your Benched {D} Pokémon (not Pecharunt ex) with your Active; it is Poisoned.
    'Subjugating Chains': {
      canUse: (ctx) =>
        !ctx.usedAbilityNameThisTurn('Subjugating Chains') &&
        !!ctx.state.players[ctx.me].active &&
        darkBench(ctx).length > 0,
      use(ctx) {
        ctx.markAbilityName('Subjugating Chains');
        const [ref] = ctx.chooseSlot({
          player: ctx.me,
          among: darkBench(ctx),
          min: 1,
          max: 1,
          message: 'Switch in which Benched Darkness Pokémon?',
        });
        ctx.switchActive(ctx.me, (ref as { index: number }).index);
        ctx.applyCondition({ player: ctx.me, zone: 'active' }, 'poisoned');
      },
    },
  },
  attacks: {
    // Irritated Outburst: 60 damage for each Prize card your opponent has taken.
    0: { damage: (ctx) => 60 * (ctx.env.ruleset.prizeCount - ctx.state.players[ctx.opp].prizes.length) },
  },
};
