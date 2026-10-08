import type { CardScript } from '@ptcg/engine';

export const name = 'Mega Manectric ex';
export const script: CardScript = {
  attacks: {
    // Flash Ray
    0: { effect: (ctx) => ctx.addMarker({ player: ctx.me, zone: 'active' }, 'preventFromBasic') },
    // Riotous Blasting: you may discard all Energy from this Pokémon for 130 more damage.
    1: {
      damage(ctx) {
        const choice = ctx.chooseOption({
          player: ctx.me,
          options: [
            { id: 'yes', label: 'Yes' },
            { id: 'no', label: 'No' },
          ],
          message: 'Discard all Energy from Mega Manectric ex for 130 more damage?',
        });
        if (choice !== 'yes') return 200;
        const self = { player: ctx.me, zone: 'active' } as const;
        ctx.discardEnergy(self, [...ctx.slot(self).energy]);
        return 330;
      },
    },
  },
};
