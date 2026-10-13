import { deckPrice } from '@ptcg/economy';
import { DECKS, deckById, type DeckId } from '../game/catalog.ts';
import type { Profile } from './types.ts';

/** Owned when a finished intro left no starter (or one that no longer exists). */
export const FALLBACK_STARTER: DeckId = 'mega-gengar';

export const isPremadeDeck = (id: string): id is DeckId => DECKS.some((d) => d.id === id);

/** Gives the player a premade deck and its cards. Already owned: returns `p` itself. */
export function grantDeck(p: Profile, id: DeckId): Profile {
  if (p.ownedDecks.includes(id)) return p;
  const collection = { ...p.collection };
  for (const c of deckById(id).list.cards) collection[c.id] = (collection[c.id] ?? 0) + c.count;
  return { ...p, ownedDecks: [...p.ownedDecks, id], collection };
}

/**
 * Brings a loaded save up to date: drops owned ids that no longer exist, and gives a player with a finished intro
 * and no decks their starter (saves made before decks were owned). Once something is owned this changes nothing,
 * so the starter's cards are granted once.
 */
export function upgradeOwnedDecks(p: Profile): Profile {
  const owned = [...new Set(p.ownedDecks)].filter(isPremadeDeck);
  const cleaned = owned.length === p.ownedDecks.length ? p : { ...p, ownedDecks: owned };
  if (!cleaned.introDone || cleaned.ownedDecks.length > 0) return cleaned;
  const starter =
    cleaned.starterDeck && isPremadeDeck(cleaned.starterDeck) ? cleaned.starterDeck : FALLBACK_STARTER;
  return grantDeck(cleaned, starter);
}

/** Why `id` can't be bought right now, or null when it can. */
export function purchaseProblem(p: Profile, id: string): string | null {
  if (!isPremadeDeck(id)) return 'Unknown deck';
  if (p.collectorMode) return 'Decks are not sold in Collector mode';
  if (p.ownedDecks.includes(id)) return 'Already owned';
  if (p.credits < deckPrice(deckById(id).kind)) return 'Not enough credits';
  return null;
}
