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
        const [prize] = ctx.state.players[ctx.me].prizes;
        if (prize) ctx.moveCard(prize, { player: ctx.me, zone: 'hand' });
      },
    },
  },
};
