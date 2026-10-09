import type { CardScript } from '@ptcg/engine';

export const name = 'Hitmonchan';
export const set = 'sv03.5';
export const script: CardScript = {
  // Counterattack: damaged in the Active Spot by an attack (even if Knocked Out), put 3 damage counters on the Attacking Pokémon.
  afterDamagedInActive(ctx, _holder, attacker) {
    ctx.placeCounters(attacker, 3);
    ctx.log('Counterattack puts 3 damage counters on the Attacking Pokémon');
  },
  attacks: {
    // Excited Punch: during your next turn, 60 more damage.
    0: { effect: (ctx) => ctx.addMarker({ player: ctx.me, zone: 'active' }, 'increaseOutgoing', 60, 2) },
  },
};
