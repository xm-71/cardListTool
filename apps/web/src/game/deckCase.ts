import { deckFormat, validateCustomDeck, validateGymDeck } from '@ptcg/economy';
import type { Profile, CustomDeck } from '../profile/types.ts';
import { DECKS, deckSources, registry } from './catalog.ts';

export type Format = 'standard' | 'gym';

/** One box in the Deck Case. */
export interface CaseEntry {
  id: string;
  name: string;
  cover: string;
  /** Energy type: the deck's own for premade decks, the cover Pokémon's for custom decks. */
  type: string | null;
  kind: 'starter' | 'theme' | 'meta' | 'custom';
  /** Custom decks only. */
  format?: Format;
  /** Why the deck can't be played, or null. */
  problem: string | null;
  active: boolean;
}

/** Filter ids: 'all', 'premade', 'custom', or an energy type. */
export type CaseFilter = string;

const coverType = (id: string): string | null => {
  const def = registry.defs[id];
  return def?.category === 'Pokemon' ? (def.types[0] ?? null) : null;
};

const asDeck = (d: CustomDeck) => ({ name: d.name, cards: d.cards });

/** Which formats a custom deck is valid in for this collection. */
export function playableIn(deck: CustomDeck, collection: Readonly<Record<string, number>>) {
  return {
    standard: validateCustomDeck(asDeck(deck), registry, collection).length === 0,
    gym: validateGymDeck(asDeck(deck), registry, collection).length === 0,
  };
}

/** The deck a match would use: the saved choice if still usable, else the starter, else the first owned deck. */
export function resolveActiveDeck(profile: Profile): string | null {
  const saved = profile.activeDeck;
  if (saved?.startsWith('custom:')) {
    const deck = profile.decks.find((d) => `custom:${d.id}` === saved);
    if (deck && playableIn(deck, profile.collection).gym) return saved;
  } else if (saved && profile.ownedDecks.includes(saved)) return saved;
  if (profile.starterDeck && profile.ownedDecks.includes(profile.starterDeck)) return profile.starterDeck;
  return profile.ownedDecks[0] ?? null;
}

/** The Deck Case boxes: owned premade decks, then custom decks. */
export function caseEntries(profile: Profile): CaseEntry[] {
  const active = resolveActiveDeck(profile);
  return deckSources(profile.decks)
    .filter((d) => d.kind === 'custom' || profile.ownedDecks.includes(d.id))
    .map((d) => {
      if (d.kind !== 'custom') {
        const info = DECKS.find((x) => x.id === d.id)!;
        return {
          id: d.id,
          name: d.name,
          cover: d.cover,
          type: info.type,
          kind: d.kind,
          problem: null,
          active: d.id === active,
        };
      }
      const deck = profile.decks.find((x) => `custom:${x.id}` === d.id)!;
      const [first] = validateGymDeck(asDeck(deck), registry, profile.collection);
      return {
        id: d.id,
        name: d.name,
        cover: d.cover,
        type: coverType(d.cover),
        kind: 'custom' as const,
        format: deckFormat(asDeck(deck), registry),
        problem: first ? `Not a legal deck: ${first}` : null,
        active: d.id === active,
      };
    });
}

export function filterEntries(entries: CaseEntry[], filter: CaseFilter): CaseEntry[] {
  if (filter === 'all') return entries;
  if (filter === 'premade') return entries.filter((e) => e.kind !== 'custom');
  if (filter === 'custom') return entries.filter((e) => e.kind === 'custom');
  return entries.filter((e) => e.type === filter);
}

/** Filter chips: all, each energy type present, premade, and custom when there are custom decks. */
export function caseFilters(entries: CaseEntry[]): CaseFilter[] {
  const types = [...new Set(entries.map((e) => e.type).filter((t): t is string => t !== null))];
  return ['all', ...types, 'premade', ...(entries.some((e) => e.kind === 'custom') ? ['custom'] : [])];
}
