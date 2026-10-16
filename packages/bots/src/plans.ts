import type { DeckPlan } from './plan.ts';

/**
 * Hand-written adjustments to a deck's computed plan, keyed by deck name. `attackers` / `support` replace the computed
 * lists; `first` names go to the front of the search priority. Only decks that need it get an entry.
 */
export const DECK_PLANS: Record<
  string,
  Partial<Pick<DeckPlan, 'attackers' | 'support'>> & { first?: string[] }
> = {};
