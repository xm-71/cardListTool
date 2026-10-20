import type { CardScript } from '@ptcg/engine';
import { inPlayRefs, isBasicEnergy } from '../util.ts';

const inHand = (ctx: Parameters<NonNullable<CardScript['trainer']>['play']>[0]) =>
  ctx.state.players[ctx.me].hand.filter((u) => isBasicEnergy(ctx.def(u), 'Water'));

export const name = 'Baxcalibur';
export const script: CardScript = {
  abilities: {
    // Super Cold: as often as you like, attach a Basic {W} Energy from your hand to 1 of your Pokémon.
    'Super Cold': {
      repeatable: true,
      canUse: (ctx) => inHand(ctx).length > 0,
      use(ctx) {
        const [uid] = ctx.chooseCards({
          player: ctx.me,
          from: inHand(ctx),
          min: 1,
          max: 1,
          message: 'Choose a Basic {W} Energy to attach',
        });
        const [ref] = ctx.chooseSlot({
          player: ctx.me,
          among: inPlayRefs(ctx, ctx.me),
          min: 1,
          max: 1,
          message: 'Attach it to which Pokémon?',
        });
        if (uid && ref) ctx.attachEnergy(uid, ref);
      },
    },
  },
};
