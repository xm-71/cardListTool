import type { EffectCtx } from './effects.ts';
import { other } from './state.ts';
import type { GameResult, GameState } from './types.ts';
import { drawCards } from './zones.ts';

export function setResult(
  state: GameState,
  winner: GameResult['winner'],
  reason: GameResult['reason'],
): void {
  if (state.result) return;
  state.result = { winner, reason };
  state.phase = 'gameOver';
  state.prompt = null;
  state.log.push({
    type: 'gameOver',
    text: winner === 'draw' ? `Draw (${reason})` : `Player ${winner + 1} wins (${reason})`,
  });
}

/** Start of the current player's turn: draw a card, or lose if the deck is empty. */
export function beginTurn(ctx: EffectCtx): void {
  const s = ctx.state;
  const p = s.current;
  s.log.push({ type: 'turnStart', player: p, text: `Turn ${s.turn}: Player ${p + 1}` });
  if (s.players[p].deck.length === 0) {
    setResult(s, other(p), 'deckOut');
    return;
  }
  drawCards(s, p, 1);
}
