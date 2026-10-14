import type { CardScript } from '@ptcg/engine';

export const name = 'Umbreon ex';
export const set = 'sv08.5';
export const script: CardScript = {
  attacks: {
    // Moon Mirage: the Defending Pokémon is now Confused.
    0: { effect: (ctx) => ctx.applyCondition({ player: ctx.opp, zone: 'active' }, 'confused') },
    // Onyx: discard all Energy from this Pokémon, and take a Prize card.
    1: {
      effect(ctx) {
        const self = { player: ctx.me, zone: 'active' } as const;
        const energy = [...ctx.slot(self).energy];
        if (energy.length > 0) ctx.discardEnergy(self, energy);
        // Taking the last Prize would have to end the game, which an attack effect cannot do in this engine
        // (only a Knock Out does), so the last Prize is left in place.
        const prizes = ctx.state.players[ctx.me].prizes;
        if (prizes.length > 1) ctx.moveCard(prizes[0]!, { player: ctx.me, zone: 'hand' });
      },
    },
  },
};
