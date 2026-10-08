import type { CardDef } from '@ptcg/engine';
import cards from './data/cards.json';
import sets from './data/sets.json';

export const SETS: readonly { id: string; name: string; logo: string }[] = sets;

/** Every card of a set, in collector-number order. */
export function setCards(setId: string): CardDef[] {
  return Object.values(cards as Record<string, CardDef>)
    .filter((c) => c.id.startsWith(`${setId}-`))
    .sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
}
