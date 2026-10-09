import { createEngine, type DeckList, type EnergyType } from '@ptcg/engine';
import {
  buildRegistry,
  megaAbomasnowDeck,
  megaCharizardXDeck,
  megaDiancieDeck,
  megaGengarDeck,
  megaKangaskhanDeck,
  megaLopunnyDeck,
  megaLucarioDeck,
  megaManectricDeck,
  megaVenusaurDeck,
} from '@ptcg/cards';

export const registry = buildRegistry();
export const engine = createEngine(registry);

export type DeckId =
  | 'mega-gengar'
  | 'mega-diancie'
  | 'mega-lucario'
  | 'mega-charizard-x'
  | 'mega-venusaur'
  | 'mega-abomasnow'
  | 'mega-manectric'
  | 'mega-kangaskhan'
  | 'mega-lopunny';

export interface DeckInfo {
  id: DeckId;
  name: string;
  /** Official starter deck, or one of our fan-made theme decks. */
  kind: 'starter' | 'theme';
  type: EnergyType;
  list: DeckList;
  /** TCGdex id of the deck's featured card, for its picture. */
  cover: string;
}

export const DECKS: DeckInfo[] = [
  {
    id: 'mega-gengar',
    name: 'Mega Gengar ex',
    kind: 'starter',
    type: 'Darkness',
    list: megaGengarDeck,
    cover: 'me02-056',
  },
  {
    id: 'mega-diancie',
    name: 'Mega Diancie ex',
    kind: 'starter',
    type: 'Psychic',
    list: megaDiancieDeck,
    cover: 'me02-041',
  },
  {
    id: 'mega-lucario',
    name: 'Mega Lucario ex',
    kind: 'starter',
    type: 'Fighting',
    list: megaLucarioDeck,
    cover: 'me01-077',
  },
  {
    id: 'mega-charizard-x',
    name: 'Mega Charizard X ex',
    kind: 'theme',
    type: 'Fire',
    list: megaCharizardXDeck,
    cover: 'me02-013',
  },
  {
    id: 'mega-venusaur',
    name: 'Mega Venusaur ex',
    kind: 'theme',
    type: 'Grass',
    list: megaVenusaurDeck,
    cover: 'me01-003',
  },
  {
    id: 'mega-abomasnow',
    name: 'Mega Abomasnow ex',
    kind: 'theme',
    type: 'Water',
    list: megaAbomasnowDeck,
    cover: 'me01-036',
  },
  {
    id: 'mega-manectric',
    name: 'Mega Manectric ex',
    kind: 'theme',
    type: 'Lightning',
    list: megaManectricDeck,
    cover: 'me01-050',
  },
  {
    id: 'mega-kangaskhan',
    name: 'Mega Kangaskhan ex',
    kind: 'theme',
    type: 'Colorless',
    list: megaKangaskhanDeck,
    cover: 'me01-104',
  },
  {
    id: 'mega-lopunny',
    name: 'Mega Lopunny ex',
    kind: 'theme',
    type: 'Colorless',
    list: megaLopunnyDeck,
    cover: 'me02-084',
  },
];

/** The official starter decks: the intro's choices. */
export const STARTER_DECKS = DECKS.filter((d) => d.kind === 'starter');

export const deckById = (id: DeckId): DeckInfo => DECKS.find((d) => d.id === id)!;

/** A deck the player can pick: a starter deck, or one of their saved custom decks. */
export interface DeckSource {
  id: string;
  name: string;
  list: DeckList;
  /** Card id shown as the deck's picture. */
  cover: string;
  kind: 'starter' | 'theme' | 'custom';
}

/** Starter decks, then theme decks, then the player's custom decks (custom ids are prefixed so they never clash). */
export function deckSources(
  custom: readonly { id: string; name: string; cards: DeckList['cards'] }[],
): DeckSource[] {
  return [
    ...DECKS.map((d) => ({ id: d.id, name: d.name, list: d.list, cover: d.cover, kind: d.kind })),
    ...custom.map((d) => {
      const pokemon = d.cards.find((c) => registry.defs[c.id]?.category === 'Pokemon');
      return {
        id: `custom:${d.id}`,
        name: d.name,
        list: { name: d.name, cards: d.cards },
        cover: pokemon?.id ?? d.cards[0]?.id ?? DECKS[0]!.cover,
        kind: 'custom' as const,
      };
    }),
  ];
}

/** Card eras, in the order the Shop and Binder show them. */
export const ERAS = [
  { id: 'mega', label: 'Mega Evolution era' },
  { id: 'classic', label: 'Classic' },
  { id: 'sv', label: 'Scarlet & Violet' },
] as const;
