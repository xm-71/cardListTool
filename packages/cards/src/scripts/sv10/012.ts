import type { CardScript } from '@ptcg/engine';
import { defAt } from '../util.ts';

export const name = 'Crustle';
export const set = 'sv10';
export const script: CardScript = {
  // Mysterious Rock Inn: prevent all damage done to this Pokémon by attacks from your opponent's Pokémon ex
  // (on the Bench too).
  incomingDamageOnBench: true,
  modifyIncomingDamage(q) {
    const self =
      q.holder.player === q.defender.player &&
      q.holder.zone === q.defender.zone &&
      (q.holder.zone === 'active' || q.holder.index === (q.defender as { index: number }).index);
    return self && defAt(q.state, q.registry, q.attacker)?.isEx ? 0 : q.amount;
  },
  attacks: {
    // Superb Scissors: this attack's damage isn't affected by any effects on your opponent's Active Pokémon.
    0: { damage: () => ({ amount: 120, ignoreWR: false, ignoreDefenderEffects: true }) },
  },
};
