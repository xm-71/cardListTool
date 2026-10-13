import type { CardScript, EffectCtx } from '@ptcg/engine';

const ABILITY = 'Voraciousness';
const leftovers = (ctx: EffectCtx) =>
  ctx.state.players[ctx.me].discard.filter((uid) => ctx.def(uid).name === 'Leftovers');

export const name = 'Snorlax';
export const set = 'sv03.5';
export const script: CardScript = {
  abilities: {
    // Once during your turn, you may put up to 2 Leftovers cards from your discard pile into your hand.
    [ABILITY]: {
      canUse: (ctx) => !ctx.usedAbilityNameThisTurn(ABILITY) && leftovers(ctx).length > 0,
      use(ctx) {
        ctx.markAbilityName(ABILITY);
        const picked = ctx.chooseCards({
          player: ctx.me,
          from: leftovers(ctx),
          min: 1,
          max: 2,
          message: 'Choose up to 2 Leftovers cards',
        });
        for (const uid of picked) ctx.moveCard(uid, { player: ctx.me, zone: 'hand' });
      },
    },
  },
  attacks: {
    // Thudding Press: this Pokémon also does 30 damage to itself.
    0: { effect: (ctx) => ctx.damageSelf(30) },
  },
};
