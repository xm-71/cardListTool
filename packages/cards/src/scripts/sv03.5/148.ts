import type { CardScript } from '@ptcg/engine';

export const name = 'Dragonair';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Aqua Slash: during your next turn, this Pokémon can't attack.
    1: { effect: (ctx) => ctx.lockAttack({ player: ctx.me, zone: 'active' }, 'Aqua Slash') },
  },
};
