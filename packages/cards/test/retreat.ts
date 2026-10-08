import type { GameState, PlayerId } from '@ptcg/engine';
import { getRetreatCost } from '@ptcg/engine';
import { registry } from './helpers.ts';

export const getRetreatCostForTest = (s: GameState, p: PlayerId) =>
  getRetreatCost(s, { player: p, zone: 'active' }, registry);
