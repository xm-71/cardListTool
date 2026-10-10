import type { PackDef } from '@ptcg/economy';
import { PackArt } from '../pack/PackArt.tsx';
import { Button } from '../retro/index.ts';
import { ProgressBar, type PackBuy } from './PackDetail.tsx';

/** A pack in the desktop grid: tap the art or name to select it, or buy it straight away. */
export function PackTile({
  pack,
  progress,
  buy,
  selected,
  onSelect,
}: {
  pack: PackDef;
  progress: { owned: number; total: number };
  buy: PackBuy;
  selected: boolean;
  onSelect(): void;
}) {
  return (
    <div
      role="group"
      aria-label={pack.name}
      className={`retro-box flex w-26 min-w-0 flex-col items-center gap-1 p-1.5 ${selected ? 'ring-4 ring-yellow' : ''}`}
    >
      <button
        type="button"
        aria-label={`Select ${pack.name}`}
        aria-pressed={selected}
        onClick={onSelect}
        className="flex w-full flex-col items-center gap-1 focus-visible:outline-2"
      >
        <PackArt setId={pack.setId} name={pack.name} size="xs" className="-rotate-3" />
        <span className="w-full truncate text-center font-pixel text-[7px] leading-snug">{pack.name}</span>
      </button>
      <span className="text-base leading-none">{buy.price}</span>
      <span className="text-sm leading-none opacity-70">
        {progress.owned} / {progress.total}
      </span>
      <ProgressBar {...progress} />
      <Button
        className="w-full whitespace-nowrap !px-1 !py-1 !text-[7px]"
        disabled={buy.disabled}
        onClick={buy.onBuy}
      >
        Buy & open
      </Button>
    </div>
  );
}
