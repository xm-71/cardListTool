import { useState } from 'react';
import type { PlayerId, SlotRef, SlotView as SlotViewData } from '@ptcg/engine';
import { CardView } from './CardView.tsx';
import { DiscardViewer } from './DiscardViewer.tsx';
import { SlotView } from './SlotView.tsx';
import type { PlayerView } from '@ptcg/engine';

interface Props {
  label: string;
  player: PlayerId;
  side: PlayerView['you'] | PlayerView['opponent'];
  /** Opponent side is drawn mirrored: Bench on top, Active closest to the middle. */
  mirrored?: boolean;
  isActive(ref: SlotRef): boolean;
  onSlot(ref: SlotRef): void;
  handCount?: number;
  benchSize: number;
}

/** One player's half of the table: Active, Bench, deck, discard pile and Prizes. */
export function Side({ label, player, side, mirrored, isActive, onSlot, handCount, benchSize }: Props) {
  const activeRef: SlotRef = { player, zone: 'active' };
  const [showDiscard, setShowDiscard] = useState(false);
  const bench = (
    <div className="flex min-h-[8.5rem] flex-wrap items-start justify-center gap-2 lg:min-h-0">
      {Array.from({ length: benchSize }, (_, index) => {
        const slot = side.bench[index];
        const ref: SlotRef = { player, zone: 'bench', index };
        return slot ? (
          <Slot
            key={index}
            slot={slot}
            size="bench"
            highlighted={isActive(ref)}
            onClick={() => onSlot(ref)}
          />
        ) : (
          <div
            key={index}
            className="aspect-[63/88] w-16 border-2 border-dashed border-ink/30 lg:w-[min(4rem,6.5vh)]"
          />
        );
      })}
    </div>
  );
  const active = (
    <div className="flex items-center justify-center gap-6">
      <Pile label="Prizes" count={side.prizeCount} />
      <div className="min-h-[9.5rem] lg:min-h-0">
        {side.active ? (
          <Slot
            slot={side.active}
            size="active"
            highlighted={isActive(activeRef)}
            onClick={() => onSlot(activeRef)}
          />
        ) : (
          <div className="aspect-[63/88] w-24 border-4 border-dashed border-ink/30 lg:w-[min(6rem,8.5vh)]" />
        )}
      </div>
      <div className="flex flex-col items-center gap-2 lg:flex-row lg:items-end">
        <Pile label="Deck" count={side.deckCount} />
        <div className="flex flex-col items-center text-lg lg:text-base lg:leading-none">
          {side.discard.length > 0 ? (
            <CardView
              card={side.discard[side.discard.length - 1]!}
              size="pile"
              onClick={() => setShowDiscard(true)}
            />
          ) : null}
          <span>Discard {side.discard.length}</span>
        </div>
      </div>
    </div>
  );
  return (
    <section
      aria-label={label}
      className="flex flex-col gap-2 border-4 border-ink/60 bg-mat/40 p-3 lg:gap-1 lg:p-2"
    >
      <div className="flex items-center justify-between font-pixel text-[9px] uppercase">
        <span className="border-2 border-ink bg-paper px-2 py-1">{label}</span>
        {handCount !== undefined && <span>{handCount} cards in hand</span>}
      </div>
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
      {showDiscard && (
        <DiscardViewer label={label} cards={side.discard} onClose={() => setShowDiscard(false)} />
      )}
    </section>
  );
}

function Slot(props: {
  slot: SlotViewData;
  size: 'bench' | 'active';
  highlighted: boolean;
  onClick(): void;
}) {
  return (
    <SlotView slot={props.slot} size={props.size} highlighted={props.highlighted} onClick={props.onClick} />
  );
}

function Pile({ label, count }: { label: string; count: number }) {
  return (
    <div className="card-back retro-shadow relative flex aspect-[63/88] w-14 lg:w-[min(3.5rem,6vh)] flex-col items-center justify-end border-4 border-ink pb-1 text-paper">
      <span className="relative z-10 font-pixel text-[10px] [text-shadow:2px_2px_var(--color-ink)]">
        {count}
      </span>
      <span className="relative z-10 font-pixel text-[6px] uppercase [text-shadow:1px_1px_var(--color-ink)]">
        {label}
      </span>
    </div>
  );
}
