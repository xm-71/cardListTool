import { opponentDeck } from './frontier/opponents.ts';
import { useProfile } from '../profile/useProfile.ts';
import { useGame } from './store.ts';

const randomSeed = (): number => (Date.now() ^ Math.floor(Math.random() * 2 ** 31)) >>> 0;

/** Starts the current Battle Frontier fight: the run deck against the next opponent, with that band's bot. */
export async function startFrontierMatch(): Promise<void> {
  const seed = randomSeed();
  // Saved first, so quitting or reloading from here on counts as a loss (and only this game's result counts).
  // When the run could not begin a fight (one already started, or the run just ended) nothing starts.
  const run = await useProfile.getState().beginFrontierMatch(seed);
  if (!run) return;
  const opponent = run.opponents[run.fight]!;
  useGame.getState().start({
    mode: 'bot',
    difficulty: opponent.difficulty,
    humanDeck: { name: 'Frontier run deck', cards: run.deck },
    botDeck: opponentDeck(opponent),
    seed,
    context: { kind: 'frontier', fight: run.fight, opponent: opponent.brain ?? opponent.name },
  });
}
