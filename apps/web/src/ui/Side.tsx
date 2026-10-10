import { useState } from 'react';
import type { PlayerId, PlayerView, SlotRef } from '@ptcg/engine';
import { engine } from '../game/catalog.ts';
import type { Selection } from '../game/selection.ts';
import { CardView } from './CardView.tsx';
import { DiscardViewer } from './DiscardViewer.tsx';
import { PrizeGrid } from './PrizeGrid.tsx';
import { SlotView } from './SlotView.tsx';

interface Props {
  label: string;
  player: PlayerId;
  side: PlayerView['you'] | PlayerView['opponent'];
  /** Opponent side is drawn mirrored: Bench on top, Active closest to the middle. */
  mirrored?: boolean;
  /** Phones: Active and Bench in the middle, the counts in one line underneath instead of the Prize and pile zones. */
  compact?: boolean;
  isActive(ref: SlotRef): boolean;
  selection: Selection | null;
  onSlot(ref: SlotRef): void;
  handCount?: number;
  benchSize: number;
}

const refSelected = (selection: Selection | null, ref: SlotRef): boolean =>
  selection?.kind === 'slot' &&
  selection.ref.player === ref.player &&
  selection.ref.zone === ref.zone &&
  (ref.zone === 'active' || (selection.ref.zone === 'bench' && selection.ref.index === ref.index));

/**
 * One player's half of the table. Wide screens get zones like a real playmat: Prizes on the left, Active and
 * Bench in the middle, deck and discard pile on the right.
 */
export function Side({
  label,
  player,
  side,
  mirrored,
  compact,
  isActive,
  selection,
  onSlot,
  handCount,
  benchSize,
}: Props) {
  const activeRef: SlotRef = { player, zone: 'active' };
  const [showDiscard, setShowDiscard] = useState(false);
  const emptySpaces = Math.max(0, benchSize - side.bench.length);
  const discardTop = side.discard[side.discard.length - 1];

  const bench = (
    <div className="flex flex-wrap items-start justify-center gap-1.5 lg:gap-2">
      {side.bench.map((slot, index) => {
        const ref: SlotRef = { player, zone: 'bench', index };
        return (
          <SlotView
            key={index}
            slot={slot}
            size="bench"
            highlighted={isActive(ref)}
            selected={refSelected(selection, ref)}
            onClick={() => onSlot(ref)}
          />
        );
      })}
      {Array.from({ length: emptySpaces }, (_, i) => (
        <div
          key={`space-${i}`}
          data-bench-space
          className={`${compact ? 'hidden' : 'hidden lg:block'} aspect-[63/88] w-14 border-2 border-dashed border-ink/30 lg:w-[min(6rem,9vh)]`}
        />
      ))}
      {/* On a phone the free Bench spaces are one chip instead of a row of empty outlines. */}
      {emptySpaces > 0 && (
        <div
          data-empty-bench
          aria-label={`${emptySpaces} empty Bench ${emptySpaces === 1 ? 'space' : 'spaces'}`}
          className={`${compact ? 'flex' : 'flex lg:hidden'} aspect-[63/88] w-14 items-center justify-center border-2 border-dashed border-ink/30 font-pixel text-[10px]`}
        >
          +{emptySpaces}
        </div>
      )}
    </div>
  );
  const active = side.active ? (
    <SlotView
      slot={side.active}
      size="active"
      highlighted={isActive(activeRef)}
      selected={refSelected(selection, activeRef)}
      onClick={() => onSlot(activeRef)}
    />
  ) : (
    <div className="aspect-[63/88] w-28 border-4 border-dashed border-ink/30 lg:w-[min(9rem,14vh)]" />
  );
  const middle = (
    <div className="flex min-w-0 flex-col items-center gap-3 lg:gap-1.5">
      {mirrored ? (
        <>
          {bench}
          {active}
        </>
      ) : (
        <>
          {active}
          {bench}
        </>
      )}
    </div>
  );

  // The label and hand count sit in the corners of the table, so they take no height from the board.
  const header = (
    <div
      className={`flex items-center justify-between font-pixel text-[9px] uppercase ${compact ? '' : 'pointer-events-none absolute inset-x-2 top-2 z-10'}`}
    >
      <span className="border-2 border-ink bg-paper px-2 py-1">{label}</span>
      {handCount !== undefined && <span>{handCount} cards in hand</span>}
    </div>
  );

  return (
    <section
      aria-label={label}
      className="relative flex flex-col gap-2 border-4 border-ink/60 bg-mat/40 p-2 lg:gap-1 lg:p-2"
    >
      {header}
      {compact ? (
        <>
          {middle}
          <p className="flex flex-wrap items-center justify-center gap-x-2 text-lg leading-tight">
            <span>Prizes {side.prizeCount}</span>·<span>Deck {side.deckCount}</span>·
            <button
              type="button"
              disabled={side.discard.length === 0}
              onClick={() => setShowDiscard(true)}
              className="underline disabled:no-underline"
            >
              Discard {side.discard.length}
            </button>
          </p>
        </>
      ) : (
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
          <PrizeGrid count={side.prizeCount} total={engine.ruleset.prizeCount} />
          {middle}
          <div className="flex flex-col items-center gap-2">
            <div className="card-back retro-shadow relative flex aspect-[63/88] w-14 flex-col items-center justify-end border-4 border-ink pb-1 text-paper lg:w-[min(3.5rem,6vh)]">
              <span className="relative z-10 font-pixel text-[10px] [text-shadow:2px_2px_var(--color-ink)]">
                {side.deckCount}
              </span>
              <span className="relative z-10 font-pixel text-[6px] uppercase [text-shadow:1px_1px_var(--color-ink)]">
                Deck
              </span>
            </div>
            <div className="flex flex-col items-center text-lg leading-none">
              {discardTop ? (
                <CardView card={discardTop} size="pile" onClick={() => setShowDiscard(true)} />
              ) : null}
              <span>Discard {side.discard.length}</span>
            </div>
          </div>
        </div>
      )}
      {showDiscard && (
        <DiscardViewer label={label} cards={side.discard} onClose={() => setShowDiscard(false)} />
      )}
    </section>
  );
}
