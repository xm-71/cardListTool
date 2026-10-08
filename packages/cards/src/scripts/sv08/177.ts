import type { CardScript } from '@ptcg/engine';
import { defAt } from '../util.ts';

export const name = 'Gravity Mountain';
export const script: CardScript = {
  modifyMaxHp: (q) => (defAt(q.state, q.registry, q.slot)?.stage === 'Stage2' ? q.hp - 30 : q.hp),
};
