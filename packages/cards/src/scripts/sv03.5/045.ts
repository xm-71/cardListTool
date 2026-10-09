import type { CardScript } from '@ptcg/engine';
import { attachBasicEnergyFromTop } from '../util.ts';

export const name = 'Vileplume';
export const set = 'sv03.5';
export const script: CardScript = {
  // Fully Blooming Energy
  onEvolveFromHand: { use: (ctx) => attachBasicEnergyFromTop(ctx, 8) },
};
