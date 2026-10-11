import { useEffect } from 'react';
import type { GameResult, PlayerId } from '@ptcg/engine';
import { sfx } from '../audio/sfx.ts';

const REASON: Record<GameResult['reason'], (loser: string) => string> = {
  prizes: () => 'All Prize cards taken',
  noPokemon: (loser) => `${loser} had no Pokémon left in play`,
  deckOut: (loser) => `${loser} couldn't draw a card`,
  concede: (loser) => `${loser} conceded`,
};

interface Props {
  result: GameResult;
  mode: 'bot' | 'hotseat';
  human: PlayerId;
  /** Credits this game earned; null when the mode pays none. */
  credits?: number | null;
  onAgain(): void;
  onHome(): void;
}

export function GameOver({ result, mode, human, credits = null, onAgain, onHome }: Props) {
  const jingle = mode !== 'bot' || result.winner === 'draw' ? null : result.winner === human ? 'win' : 'lose';
  useEffect(() => {
    if (jingle) sfx(jingle);
  }, [jingle]);
  const name = (p: PlayerId) => (mode === 'bot' ? (p === human ? 'You' : 'The bot') : `Player ${p + 1}`);
  const title =
    result.winner === 'draw'
      ? 'Draw'
      : mode === 'bot'
        ? result.winner === human
          ? 'You win!'
          : 'You lose'
        : `Player ${result.winner + 1} wins`;
  const loser = result.winner === 'draw' ? 'Both players' : name(result.winner === 0 ? 1 : 0);
  return (
    <div
      role="dialog"
      aria-label="Game over"
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink-fixed/70 p-6"
    >
      <div className="retro-box flex w-full max-w-sm flex-col items-center gap-4 p-6 text-center">
        <h2 className="font-pixel text-lg text-red-fg uppercase">{title}</h2>
        <p className="text-2xl">{REASON[result.reason](loser)}</p>
        {credits !== null && <p className="font-pixel text-xs text-green-fg">+{credits} credits</p>}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onAgain}
            className="retro-shadow border-4 border-ink bg-yellow px-4 py-2 font-pixel text-[10px] uppercase text-ink-fixed hover:brightness-105"
          >
            Play again
          </button>
          <button
            type="button"
            onClick={onHome}
            className="border-4 border-ink bg-paper px-3 py-2 font-pixel text-[10px] uppercase text-ink hover:bg-cream"
          >
            Home
          </button>
        </div>
      </div>
    </div>
  );
}
