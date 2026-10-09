import { SETS, setCards } from '@ptcg/cards';
import { ERAS } from '../game/catalog.ts';
import { artUrls } from './art.ts';

export interface ArtGroup {
  id: string;
  label: string;
  urls: string[];
}

/** The art of each era that has sets in the shop, in the order the Shop shows them (for per-era downloads). */
export function eraArt(): ArtGroup[] {
  return ERAS.flatMap((era) => {
    const ids = SETS.filter((s) => s.era === era.id).map((s) => s.id);
    return ids.length === 0 ? [] : [{ id: era.id, label: era.label, urls: artUrls(ids.flatMap((id) => setCards(id))) }];
  });
}
