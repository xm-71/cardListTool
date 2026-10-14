import type { CardScript } from '@ptcg/engine';

export const name = 'Golbat';
export const set = 'sv06.5';
export const script: CardScript = {
  attacks: {
    // Pitch-Black Blade: during your next turn, this Pokémon can't attack.
    1: { effect: (ctx) => ctx.lockAttack({ player: ctx.me, zone: 'active' }, 'Pitch-Black Blade') },
  },
};
