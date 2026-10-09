import { GYM_DECKS } from '@ptcg/cards';
import { registry, type DeckSource } from './catalog.ts';
import { CHAMPION_STAGE, ELITE, LEADERS, championDeckFor, mainEnergyType, type DeckRef } from './gym.ts';
import { useGame } from './store.ts';

export const refOf = (d: DeckSource): DeckRef => ({ kind: d.kind, id: d.id });

/** The player's deck for a run, or undefined when it no longer exists (a deleted or invalid custom deck). */
export const resolveDeck = (ref: DeckRef, sources: readonly DeckSource[]): DeckSource | undefined =>
  sources.find((d) => d.id === ref.id);

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
export function startEliteMatch(stage: number, deck: DeckSource): void {
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
    context: { kind: 'elite', stage, deck: refOf(deck), deckName: deck.name, cover: deck.cover },
  });
}
