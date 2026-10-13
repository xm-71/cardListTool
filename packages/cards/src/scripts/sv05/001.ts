import type { CardScript } from '@ptcg/engine';

export const name = 'Scyther';
export const set = 'sv05';
export const script: CardScript = {
  attacks: {
    // Slashing Strike: during your next turn, this Pokémon can't use Slashing Strike.
    1: { effect: (ctx) => ctx.lockAttack({ player: ctx.me, zone: 'active' }, 'Slashing Strike') },
  },
};
