import { createEngine, type DeckList, type EnergyType } from '@ptcg/engine';
import { buildRegistry, megaDiancieDeck, megaGengarDeck, megaLucarioDeck } from '@ptcg/cards';

export const registry = buildRegistry();
export const engine = createEngine(registry);

export type DeckId = 'mega-gengar' | 'mega-diancie' | 'mega-lucario';

export interface DeckInfo {
  id: DeckId;
  name: string;
  type: EnergyType;
  list: DeckList;
  /** TCGdex id of the deck's featured card, for its picture. */
  cover: string;
}

export const DECKS: DeckInfo[] = [
  { id: 'mega-gengar', name: 'Mega Gengar ex', type: 'Darkness', list: megaGengarDeck, cover: 'me02-056' },
  { id: 'mega-diancie', name: 'Mega Diancie ex', type: 'Psychic', list: megaDiancieDeck, cover: 'me02-041' },
  { id: 'mega-lucario', name: 'Mega Lucario ex', type: 'Fighting', list: megaLucarioDeck, cover: 'me01-077' },
];

export const deckById = (id: DeckId): DeckInfo => DECKS.find((d) => d.id === id)!;
