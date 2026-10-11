import { useEffect, useState } from 'react';
import type { GameResult, PlayerId } from '@ptcg/engine';
import { sfx } from '../audio/sfx.ts';
import { CHAMPION_STAGE, ELITE, LEADERS } from '../game/gym.ts';
import type { GameContext } from '../game/store.ts';
import type { GymPayout } from '../profile/useProfile.ts';
import { CharacterPortrait } from './CharacterPortrait.tsx';
import { PackOpening } from './PackOpening.tsx';
import { Button } from './retro/index.ts';

interface Props {
  context: GameContext;
  result: GameResult;
  human: PlayerId;
  /** What the game paid; undefined while it is being saved. */
  payout: GymPayout | undefined;
  onBack(): void;
  /** Play the same gym again. */
  onRematch(): void;
  /** Elite Four: the next match of the run. */
  onNext(): void;
}

/** The result of a Gym Challenge match: the opponent's line, what was earned, reward packs and where to go next. */
export function GymGameOver({ context, result, human, payout, onBack, onRematch, onNext }: Props) {
  const won = result.winner === human;
  const draw = result.winner === 'draw';
  const [opening, setOpening] = useState(0);
  const [showing, setShowing] = useState(false);
  useEffect(() => {
    if (!draw) sfx(won ? 'win' : 'lose');
  }, [won, draw]);

  const opponent =
    context.kind === 'gym' ? LEADERS.find((l) => l.id === context.leaderId)! : ELITE[context.stage]!;
  const packs = payout?.packs ?? [];
  const hasMorePacks = opening < packs.length;
  // After a win the run moves to the next opponent; after a draw the same match is replayed.
  const nextStage =
    context.kind === 'elite'
      ? draw
        ? context.stage
        : won && context.stage < CHAMPION_STAGE
          ? context.stage + 1
          : null
      : null;
  const title = draw
    ? 'Draw'
    : won
      ? payout?.champion
        ? 'Champion!'
        : payout?.badge && opponent.badge
          ? `${opponent.badge} Badge earned!`
          : 'You win!'
      : 'You lose';

  return (
    <div
      role="dialog"
      aria-label="Game over"
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink/70 p-6"
    >
      <div className="retro-box flex w-full max-w-md flex-col items-center gap-4 p-6 text-center">
        <CharacterPortrait id={opponent.id} name={opponent.name} size={96} />
        <h2 className="font-pixel text-lg text-red uppercase">{title}</h2>
        {draw ? (
          <p className="text-2xl">
            {context.kind === 'elite'
              ? 'The match is replayed. Your run continues.'
              : "It's a draw. Nobody takes the win."}
          </p>
        ) : (
          <p className="text-2xl">
            <strong>{opponent.name}:</strong> {won ? opponent.win : opponent.lose}
          </p>
        )}
        {/* Read out by screen readers as it appears: saving, then what was earned. */}
        <div role="status" aria-live="polite" className="flex flex-col items-center gap-4">
          {payout === undefined ? (
            <p className="font-pixel text-xs">Saving…</p>
          ) : (
            <>
              {payout.counted === false && (
                <p className="text-xl">
                  This match did not count: your run has moved on (maybe in another tab).
                </p>
              )}
              {payout.credits > 0 && (
                <p className="font-pixel text-xs text-green">+{payout.credits} credits</p>
              )}
              {packs.length > 0 && (
                <p className="text-xl">
                  {packs.length === 1
                    ? 'You won a Scarlet & Violet 151 pack!'
                    : `You won ${packs.length} Scarlet & Violet 151 packs!`}
                </p>
              )}
            </>
          )}
        </div>
        {payout !== undefined && packs.length > 0 && hasMorePacks && (
          <Button onClick={() => setShowing(true)}>
            Open pack {opening + 1} of {packs.length}
          </Button>
        )}
        <div className="flex flex-wrap justify-center gap-3">
          {nextStage !== null && (
            <Button disabled={payout === undefined} onClick={onNext}>
              {draw ? 'Replay' : 'Next'}: {ELITE[nextStage]!.name}
            </Button>
          )}
          {context.kind === 'gym' && (
            <Button disabled={payout === undefined} variant={won ? 'plain' : 'primary'} onClick={onRematch}>
              {won ? 'Rematch' : 'Try again'}
            </Button>
          )}
          <Button variant="plain" disabled={payout === undefined} onClick={onBack}>
            Gym Challenge
          </Button>
        </div>
      </div>
      {showing && hasMorePacks && (
        <PackOpening
          key={opening}
          setId="sv03.5"
          cards={packs[opening]!}
          onDone={() => {
            setShowing(false);
            setOpening(opening + 1);
          }}
        />
      )}
    </div>
  );
}
