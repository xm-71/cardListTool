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

/** A deck the player can pick: a starter deck, or one of their saved custom decks. */
export interface DeckSource {
  id: string;
  name: string;
  list: DeckList;
  /** Card id shown as the deck's picture. */
  cover: string;
  custom: boolean;
}

/** Starter decks first, then the player's custom decks (custom ids are prefixed so they never clash). */
export function deckSources(
  custom: readonly { id: string; name: string; cards: DeckList['cards'] }[],
): DeckSource[] {
  return [
    ...DECKS.map((d) => ({ id: d.id, name: d.name, list: d.list, cover: d.cover, custom: false })),
    ...custom.map((d) => {
      const pokemon = d.cards.find((c) => registry.defs[c.id]?.category === 'Pokemon');
      return {
        id: `custom:${d.id}`,
        name: d.name,
        list: { name: d.name, cards: d.cards },
        cover: pokemon?.id ?? d.cards[0]?.id ?? DECKS[0]!.cover,
        custom: true,
      };
    }),
  ];
}

/** Card eras, in the order the Shop and Binder show them. */
export const ERAS = [
  { id: 'mega', label: 'Mega Evolution era' },
  { id: 'classic', label: 'Classic' },
] as const;
