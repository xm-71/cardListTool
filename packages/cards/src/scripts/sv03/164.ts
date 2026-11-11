import type { CardScript } from '@ptcg/engine';

const ABILITY = 'Quick Search';

export const name = 'Pidgeot ex';
export const set = 'sv03';
export const script: CardScript = {
  abilities: {
    // Quick Search: once during your turn, search your deck for a card and put it into your hand. You can't use more
    // than 1 Quick Search Ability each turn.
    [ABILITY]: {
      canUse: (ctx) => !ctx.usedAbilityNameThisTurn(ABILITY),
      use(ctx) {
        ctx.markAbilityName(ABILITY);
        const [uid] = ctx.chooseCards({
          player: ctx.me,
          from: [...ctx.state.players[ctx.me].deck],
          min: 0,
          max: 1,
          message: 'Choose a card to put into your hand',
        });
        if (uid) ctx.moveCard(uid, { player: ctx.me, zone: 'hand' });
        ctx.shuffleDeck(ctx.me);
      },
    },
  },
  attacks: {
    // Blustery Wind: you may discard a Stadium in play.
    0: {
      effect(ctx) {
        if (!ctx.state.stadium) return;
        const pick = ctx.chooseOption({
          player: ctx.me,
          options: [
            { id: 'yes', label: 'Discard the Stadium in play' },
            { id: 'no', label: 'Keep it' },
          ],
          message: 'Blustery Wind: discard the Stadium in play?',
        });
        if (pick === 'yes') ctx.discardStadium();
      },
    },
  },
};
