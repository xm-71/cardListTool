import type { CardScript } from '@ptcg/engine';
import { defAt } from '../util.ts';

export const name = 'Growing Grass Energy';
export const script: CardScript = {
  // The {G} Pokémon this card is attached to gets +20 HP.
  modifyMaxHp: (q) => (defAt(q.state, q.registry, q.slot)?.types.includes('Grass') ? q.hp + 20 : q.hp),
};
