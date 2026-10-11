import type { CardScript, EffectCtx } from '@ptcg/engine';
import { abilityHolder, isBasicEnergy } from '../util.ts';

const grassInHand = (ctx: EffectCtx) =>
  ctx.state.players[ctx.me].hand.filter((u) => isBasicEnergy(ctx.def(u), 'Grass'));

export const name = 'Teal Mask Ogerpon ex';
export const set = 'sv06';
export const script: CardScript = {
  abilities: {
    // Teal Dance: attach a Basic {G} Energy from your hand to this Pokémon, then draw a card.
    'Teal Dance': {
      canUse: (ctx) => grassInHand(ctx).length > 0,
      use(ctx) {
        const [uid] = ctx.chooseCards({
          player: ctx.me,
          from: grassInHand(ctx),
          min: 1,
          max: 1,
          message: 'Choose a Basic Grass Energy',
        });
        ctx.attachEnergy(uid!, abilityHolder(ctx));
        ctx.draw(ctx.me, 1);
      },
    },
  },
  attacks: {
    // Myriad Leaf Shower: 30 more damage for each Energy attached to both Active Pokémon.
    0: {
      damage(ctx) {
        const p = ctx.state.players;
        return 30 + 30 * ((p[ctx.me].active?.energy.length ?? 0) + (p[ctx.opp].active?.energy.length ?? 0));
      },
    },
  },
};
