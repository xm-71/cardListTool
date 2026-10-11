import type { PlayerId, PlayerView, SlotRef } from '@ptcg/engine';
import { topCard, topDef } from '../game/view.ts';
import type { Selection } from '../game/selection.ts';
import { CardView } from './CardView.tsx';

/** Phones: the opponent as a compact strip (their Active, Bench HP chips and counts) with a button for the full board. */
export function OpponentStrip({
  player,
  side,
  selection,
  onSlot,
  onViewBoard,
}: {
  player: PlayerId;
  side: PlayerView['opponent'];
  selection: Selection | null;
  onSlot(ref: SlotRef): void;
  onViewBoard(): void;
}) {
  const activeRef: SlotRef = { player, zone: 'active' };
  const selected = (ref: SlotRef) =>
    selection?.kind === 'slot' &&
    selection.ref.zone === ref.zone &&
    (ref.zone === 'active' || (selection.ref.zone === 'bench' && selection.ref.index === ref.index));
  return (
    <section aria-label="Opponent" className="flex items-center gap-3 border-4 border-ink/60 bg-mat/40 p-2">
      {side.active ? (
        <div className="flex flex-col items-center gap-0.5">
          <CardView
            card={topCard(side.active)}
            size="xs"
            selected={selected(activeRef)}
            onClick={() => onSlot(activeRef)}
          />
          <span className="font-pixel text-[7px]">
            {Math.max(0, (side.active.hp ?? topDef(side.active).hp) - side.active.damage)}
          </span>
        </div>
      ) : (
        <div className="aspect-[63/88] w-12 border-2 border-dashed border-ink/30" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap gap-1.5">
          {side.bench.map((slot, index) => {
            const def = topDef(slot);
            const hp = Math.max(0, (slot.hp ?? def.hp) - slot.damage);
            return (
              <button
                key={index}
                type="button"
                aria-label={`Bench ${index + 1}: ${def.name} ${hp} HP`}
                onClick={() => onSlot({ player, zone: 'bench', index })}
                className={`min-h-9 min-w-9 border-2 border-ink bg-paper px-1 font-pixel text-[8px] ${selected({ player, zone: 'bench', index }) ? 'bg-yellow text-ink-fixed' : ''}`}
              >
                {hp}
              </button>
            );
          })}
          {side.bench.length === 0 && <span className="text-lg opacity-70">No Bench</span>}
        </div>
        <p className="text-lg leading-tight">
          <span>{side.handCount} cards in hand</span>
        </p>
        <p className="text-base leading-tight opacity-80">
          Prizes {side.prizeCount} · Deck {side.deckCount} · Discard {side.discard.length}
        </p>
      </div>
      <button
        type="button"
        onClick={onViewBoard}
        className="shrink-0 border-4 border-ink bg-paper px-2 py-2 font-pixel text-[8px] uppercase hover:bg-cream"
      >
        View board
      </button>
    </section>
  );
}
