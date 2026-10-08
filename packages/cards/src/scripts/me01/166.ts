import type { CardScript } from '@ptcg/engine';

export const name = 'Air Balloon';
export const script: CardScript = {
  modifyRetreatCost: (q) => q.cost - 2,
};
