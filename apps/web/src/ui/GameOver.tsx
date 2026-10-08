import type { GameResult, PlayerId } from '@ptcg/engine';

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
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-6"
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl bg-slate-900 p-6 text-center shadow-2xl ring-1 ring-white/10">
        <h2 className="text-3xl font-bold text-amber-300">{title}</h2>
        <p className="text-white/70">{REASON[result.reason](loser)}</p>
        {credits !== null && <p className="font-semibold text-amber-300">+{credits} credits</p>}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onAgain}
            className="rounded-lg bg-amber-400 px-5 py-2 font-semibold text-slate-900 hover:bg-amber-300"
          >
            Play again
          </button>
          <button
            type="button"
            onClick={onHome}
            className="rounded-lg bg-white/10 px-5 py-2 hover:bg-white/20"
          >
            Home
          </button>
        </div>
      </div>
    </div>
  );
}
