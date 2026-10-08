import type { PlayerId, SlotRef, SlotView as SlotViewData } from '@ptcg/engine';
import { CardView } from './CardView.tsx';
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
  const bench = (
    <div className="flex min-h-[8.5rem] flex-wrap items-start justify-center gap-2">
      {Array.from({ length: benchSize }, (_, index) => {
        const slot = side.bench[index];
        const ref: SlotRef = { player, zone: 'bench', index };
        return slot ? (
          <Slot key={index} slot={slot} size="sm" highlighted={isActive(ref)} onClick={() => onSlot(ref)} />
        ) : (
          <div key={index} className="aspect-[63/88] w-16 rounded-lg border border-dashed border-white/15" />
        );
      })}
    </div>
  );
  const active = (
    <div className="flex items-center justify-center gap-6">
      <Pile label="Prizes" count={side.prizeCount} />
      <div className="min-h-[9.5rem]">
        {side.active ? (
          <Slot
            slot={side.active}
            size="md"
            highlighted={isActive(activeRef)}
            onClick={() => onSlot(activeRef)}
          />
        ) : (
          <div className="aspect-[63/88] w-24 rounded-lg border border-dashed border-white/20" />
        )}
      </div>
      <div className="flex flex-col items-center gap-2">
        <Pile label="Deck" count={side.deckCount} />
        <div className="flex flex-col items-center text-xs text-white/60">
          {side.discard.length > 0 ? (
            <CardView card={side.discard[side.discard.length - 1]!} size="xs" />
          ) : null}
          <span>Discard {side.discard.length}</span>
        </div>
      </div>
    </div>
  );
  return (
    <section aria-label={label} className="flex flex-col gap-2 rounded-xl bg-felt/60 p-3">
      <div className="flex items-center justify-between text-sm text-white/70">
        <span className="font-semibold">{label}</span>
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
    </section>
  );
}

function Slot(props: { slot: SlotViewData; size: 'sm' | 'md'; highlighted: boolean; onClick(): void }) {
  return (
    <SlotView slot={props.slot} size={props.size} highlighted={props.highlighted} onClick={props.onClick} />
  );
}

function Pile({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex aspect-[63/88] w-14 flex-col items-center justify-center rounded-lg bg-gradient-to-br from-blue-800 to-blue-950 text-xs shadow ring-1 ring-white/20">
      <span className="text-lg font-bold">{count}</span>
      <span className="text-white/70">{label}</span>
    </div>
  );
}
