import type { CardScript } from '@ptcg/engine';
import { wildGrowthCost } from '../util.ts';

export const name = 'Meganium';
export const set = 'me01';
export const script: CardScript = {
  // Wild Growth: each Basic {G} Energy attached to all of your Pokémon provides {G}{G} Energy (doesn't stack). The
  // attackers of this deck apply it to their own attack cost (see `wildGrowthCost`); Meganium's own Solar Beam is one.
  modifyAttackCost: wildGrowthCost,
};
