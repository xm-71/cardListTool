import type { CardScript } from '@ptcg/engine';
import { defAt } from '../util.ts';

export const name = 'Bravery Charm';
export const script: CardScript = {
  // The Basic Pokémon this card is attached to gets +50 HP.
  modifyMaxHp: (q) => (defAt(q.state, q.registry, q.slot)?.stage === 'Basic' ? q.hp + 50 : q.hp),
};
