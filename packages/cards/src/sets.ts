import type { CardDef } from '@ptcg/engine';
import cards from './data/cards.json';
import sets from './data/sets.json';

export type Era = 'mega' | 'classic' | 'ecard' | 'ex' | 'dp' | 'pt' | 'hgss' | 'sv';

/** Only the Mega Evolution era (and Scarlet & Violet in the Gym format) can be played; every older era is collect-only. */
export const isCollectOnlyEra = (era: Era): boolean => era !== 'mega' && era !== 'sv';

/** WotC-era sets: collectible now, playable once a Classic ruleset exists. */
const CLASSIC = new Set(['base1', 'base2', 'base3', 'base4', 'base5', 'gym1', 'gym2', 'neo1', 'neo2', 'neo3', 'neo4', 'lc']);

const ECARD = new Set(['ecard1', 'ecard2', 'ecard3']);
const EX = new Set(Array.from({ length: 16 }, (_, i) => `ex${i + 1}`));

/** Scarlet & Violet sets: collectible, and playable only in the Gym format. */
const SV = new Set(['sv03.5']);

export const SETS: readonly { id: string; name: string; logo: string; era: Era }[] = sets.map((s) => ({
  ...s,
  era: CLASSIC.has(s.id)
    ? 'classic'
    : ECARD.has(s.id)
      ? 'ecard'
      : EX.has(s.id)
        ? 'ex'
        : SV.has(s.id)
          ? 'sv'
          : 'mega',
}));

/** Every card of a set, in collector-number order. */
export function setCards(setId: string): CardDef[] {
  return Object.values(cards as Record<string, CardDef>)
    .filter((c) => c.id.startsWith(`${setId}-`))
    .sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
}
