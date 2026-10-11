import type { CardScript } from '@ptcg/engine';

export const name = 'Spiky Energy';
export const script: CardScript = {
  // When the Active Pokémon this is attached to is damaged by an opponent's attack, put 2 damage counters on the
  // Attacking Pokémon.
  afterDamagedInActive: (ctx, _holder, attacker) => ctx.placeCounters(attacker, 2),
};
