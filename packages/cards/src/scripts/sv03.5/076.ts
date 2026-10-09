import type { CardScript } from '@ptcg/engine';

export const name = 'Golem ex';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Dynamic Roll: during your next turn, this Pokémon's attacks do 120 more damage.
    0: { effect: (ctx) => ctx.addMarker({ player: ctx.me, zone: 'active' }, 'increaseOutgoing', 120, 2) },
    // Rock Blaster: damage isn't affected by Resistance.
    1: { damage: () => ({ amount: 180, ignoreWR: false, ignoreResistance: true }) },
  },
};
