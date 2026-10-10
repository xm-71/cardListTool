import type { PackDef } from '@ptcg/economy';
import { PackArt } from '../pack/PackArt.tsx';
import { Button } from '../retro/index.ts';
import { ProgressBar, type PackBuy } from './PackDetail.tsx';

/** A pack in the phone list: tap the row for its details, or buy it with the button. */
export function PackRow({
  pack,
  progress,
  buy,
  onDetails,
}: {
  pack: PackDef;
  progress: { owned: number; total: number };
  buy: PackBuy;
  onDetails(): void;
}) {
  return (
    <div
      role="group"
      aria-label={pack.name}
      className="flex items-center gap-2 border-b-2 border-ink/20 py-1.5"
    >
      <button
        type="button"
        aria-label={`Details for ${pack.name}`}
        onClick={onDetails}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left"
      >
        <PackArt setId={pack.setId} name={pack.name} size="mini" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-xl leading-none">{pack.name}</span>
          <span className="flex items-center gap-2 text-base leading-none">
            <span className="opacity-70">{buy.price}</span>
            <span className="text-sm">
              {progress.owned} / {progress.total}
            </span>
          </span>
          <ProgressBar {...progress} />
        </span>
      </button>
      <Button className="shrink-0 !px-2 !py-2 !text-[8px]" disabled={buy.disabled} onClick={buy.onBuy}>
        Buy & open
      </Button>
    </div>
  );
}
