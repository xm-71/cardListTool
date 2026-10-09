import { GYM_DECKS } from '@ptcg/cards';
import { registry, type DeckSource } from './catalog.ts';
import {
  CHAMPION_STAGE,
  ELITE,
  LEADERS,
  championDeckFor,
  mainEnergyType,
  type DeckRef,
  type RunDeck,
} from './gym.ts';
import { useProfile } from '../profile/useProfile.ts';
import { useGame } from './store.ts';

export const refOf = (d: DeckSource): DeckRef => ({ kind: d.kind, id: d.id });

/** The deck a ref points to (for a gym rematch), or undefined when it no longer exists. */
export const resolveDeck = (ref: DeckRef, sources: readonly DeckSource[]): DeckSource | undefined =>
  sources.find((d) => d.id === ref.id);

/** A copy of the deck's contents for a run to be locked to. */
export const snapshotOf = (d: DeckSource): RunDeck => ({
  ...refOf(d),
  name: d.name,
  cover: d.cover,
  cards: d.list.cards.map((c) => ({ id: c.id, count: c.count })),
});

/** The locked run deck as a deck the game can play. */
export const runDeckSource = (r: RunDeck): DeckSource => ({
  id: r.id,
  name: r.name,
  cover: r.cover,
  kind: r.kind,
  list: { name: r.name, cards: r.cards },
});

const randomSeed = (): number => (Date.now() ^ Math.floor(Math.random() * 2 ** 31)) >>> 0;

/** Starts a gym match against `leader` with the player's `deck`. */
export function startGymMatch(leaderId: string, deck: DeckSource): void {
  const leader = LEADERS.find((l) => l.id === leaderId)!;
  useGame.getState().start({
    mode: 'bot',
    difficulty: leader.difficulty,
    humanDeck: deck.list,
    botDeck: GYM_DECKS[leader.deck],
    seed: randomSeed(),
    context: { kind: 'gym', leaderId, deck: refOf(deck) },
  });
}

/** Starts the Elite Four or Champion match for `stage` with the run's locked deck. */
export async function startEliteMatch(stage: number, deck: DeckSource): Promise<void> {
  // Saved first, so quitting or reloading from here on counts as a loss.
  await useProfile.getState().beginEliteMatch(stage);
  const opponent = ELITE[stage]!;
  // Blue picks the ace that counters the challenger's main Energy.
  const botDeck =
    stage === CHAMPION_STAGE
      ? GYM_DECKS[championDeckFor(mainEnergyType(deck.list, registry.defs))]
      : GYM_DECKS[opponent.deck];
  useGame.getState().start({
    mode: 'bot',
    difficulty: opponent.difficulty,
    humanDeck: deck.list,
    botDeck,
    seed: randomSeed(),
    context: { kind: 'elite', stage, deckName: deck.name, cover: deck.cover },
  });
}
