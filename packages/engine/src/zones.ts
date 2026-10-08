import type { GameState, PlayerId } from './types.ts';
import { shuffle } from './rng.ts';

/** Draw up to n cards (fewer if the deck runs out). Returns the uids drawn. */
export function drawCards(state: GameState, player: PlayerId, n: number): string[] {
  const p = state.players[player];
  const drawn = p.deck.splice(0, Math.max(0, n));
  p.hand.push(...drawn);
  return drawn;
}

export function shuffleDeck(state: GameState, player: PlayerId): void {
  const [deck, rng] = shuffle(state.players[player].deck, state.rng);
  state.players[player].deck = deck;
  state.rng = rng;
}

export function removeFrom(list: string[], uid: string): void {
  const i = list.indexOf(uid);
  if (i < 0) throw new Error(`Card ${uid} not found in zone`);
  list.splice(i, 1);
}
