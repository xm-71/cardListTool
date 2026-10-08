import type { CardDef } from '@ptcg/engine';
import cards from './data/cards.json';
import sets from './data/sets.json';

export type Era = 'mega' | 'classic';

/** WotC-era sets: collectible now, playable once a Classic ruleset exists. */
const CLASSIC = new Set(['base1', 'base2', 'base3', 'base4', 'base5', 'gym1', 'gym2', 'neo1']);

export const SETS: readonly { id: string; name: string; logo: string; era: Era }[] = sets.map((s) => ({
  ...s,
  era: CLASSIC.has(s.id) ? 'classic' : 'mega',
}));

/** Every card of a set, in collector-number order. */
export function setCards(setId: string): CardDef[] {
  return Object.values(cards as Record<string, CardDef>)
    .filter((c) => c.id.startsWith(`${setId}-`))
    .sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
}
