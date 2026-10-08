import { act as rtlAct } from '@testing-library/react';
import type { GameState, PlayerId } from '@ptcg/engine';
import { engine } from '../src/game/catalog.ts';
import { useGame, type GameConfig } from '../src/game/store.ts';

export const botCfg = (seed: number): GameConfig => ({
  mode: 'bot',
  humanDeck: deckById('mega-gengar').list,
  botDeck: deckById('mega-diancie').list,
  seed,
});

/** First seed (from `from`) whose opening prompt goes to seat 0. */
export function seedWhereSeat0PromptsFirst(from = 1): number {
  for (let seed = from; seed < from + 200; seed++) {
    if (
      engine.createGame({ decks: [deckList('mega-gengar'), deckList('mega-diancie')], seed }).prompt
        ?.player === 0
    )
      return seed;
  }
  throw new Error('no seed found');
}
import { deckById, type DeckId } from '../src/game/catalog.ts';
const deckList = (id: DeckId) => deckById(id).list;

/** Answer every setup prompt (first option, then Done) through the store, for both seats. */
export function finishSetupInStore(): void {
  for (let i = 0; i < 50; i++) {
    const s = useGame.getState().state!;
    if (s.phase !== 'setup' || !s.prompt) return;
    const pr = s.prompt;
    const optionId = pr.selected.length >= pr.min ? 'done' : pr.options[0]!.id;
    rtlAct(() => useGame.getState().dispatch(pr.player, { type: 'answer', optionId }));
  }
}

/** Make it `player`'s main-phase turn (ending the other player's turn if needed). */
export function turnOf(player: PlayerId): void {
  const s = useGame.getState().state!;
  if (s.current !== player) rtlAct(() => useGame.getState().dispatch(s.current, { type: 'endTurn' }));
}

export function mutate(fn: (s: GameState) => void): void {
  const s = structuredClone(useGame.getState().state!);
  fn(s);
  rtlAct(() => useGame.setState({ state: s }));
}
