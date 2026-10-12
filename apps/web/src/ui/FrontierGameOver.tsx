import { useEffect } from 'react';
import type { GameResult, PlayerId } from '@ptcg/engine';
import { sfx } from '../audio/sfx.ts';
import { FRONTIER_BRAINS } from '../game/frontier/opponents.ts';
import type { FrontierRun } from '../game/frontier/run.ts';
import type { FrontierPayout } from '../game/frontier/save.ts';
import type { GameContext } from '../game/store.ts';
import { Button } from './retro/index.ts';

interface Props {
  context: Extract<GameContext, { kind: 'frontier' }>;
  result: GameResult;
  human: PlayerId;
  run: FrontierRun | null;
  /** What the fight did to the run; undefined while saving. */
  payout: FrontierPayout | undefined;
  /** Back to the Battle Frontier screen (the reward, the hub or the end of the run). */
  onBack(): void;
  /** Play the same fight again (after a loss or a draw). */
  onRetry(): void;
}

/** The result of a Battle Frontier fight. */
export function FrontierGameOver({ context, result, human, run, payout, onBack, onRetry }: Props) {
  const won = result.winner === human;
  const draw = result.winner === 'draw';
  useEffect(() => {
    if (!draw) sfx(won ? 'win' : 'lose');
  }, [won, draw]);
  const opponent = run?.opponents[context.fight];
  const brain = opponent?.brain ? FRONTIER_BRAINS[opponent.id] : undefined;
  const over = payout?.phase === 'over';
  return (
    <div
      role="dialog"
      aria-label="Game over"
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink-fixed/70 p-6"
    >
      <div className="retro-box flex w-full max-w-md flex-col items-center gap-4 p-6 text-center">
        <h2 className="font-pixel text-lg text-red-fg uppercase">
          {draw ? 'Draw' : won ? 'You win!' : 'You lose'}
        </h2>
        {brain && !draw && (
          <p className="text-2xl">
            <strong>{brain.name}:</strong> {won ? brain.win : brain.lose}
          </p>
        )}
        <div role="status" aria-live="polite" className="flex flex-col items-center gap-2">
          {payout === undefined ? (
            <p className="font-pixel text-xs">Saving…</p>
          ) : payout.counted === false ? (
            <p className="text-xl">This fight did not count: your run has moved on (maybe in another tab).</p>
          ) : draw ? (
            <p className="text-xl">The fight is replayed. No life lost.</p>
          ) : won ? (
            <p className="text-xl">
              {over ? 'You conquered the Battle Frontier!' : 'Choose your reward next.'}
            </p>
          ) : (
            <p className="text-xl">
              {over ? 'No lives left. The run is over.' : `Lives left: ${payout.lives}`}
            </p>
          )}
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          {payout?.counted && !over && !won && (
            <Button onClick={onRetry}>{draw ? 'Replay fight' : 'Retry fight'}</Button>
          )}
          <Button
            variant={won || over ? 'primary' : 'plain'}
            disabled={payout === undefined}
            onClick={onBack}
          >
            {won ? (over ? 'See results' : 'Continue') : over ? 'See results' : 'Battle Frontier'}
          </Button>
        </div>
      </div>
    </div>
  );
}
