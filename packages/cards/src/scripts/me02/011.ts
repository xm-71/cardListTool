import type { CardScript } from '@ptcg/engine';
import { slotAt } from '../util.ts';

export const name = 'Charmander';
export const script: CardScript = {
  // Agile: no Retreat Cost while it has no Energy attached.
  modifyRetreatCost: (q) => (slotAt(q.state, q.slot)?.energy.length === 0 ? 0 : q.cost),
};
