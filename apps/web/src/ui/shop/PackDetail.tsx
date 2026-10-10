import { packContents, type PackDef } from '@ptcg/economy';
import { eraLabel } from '../../game/catalog.ts';
import { PackArt } from '../pack/PackArt.tsx';
import { Button } from '../retro/index.ts';

export interface PackBuy {
  /** The price line: "100 credits" or "FREE". */
  price: string;
  disabled: boolean;
  onBuy(): void;
}

/** A thin bar showing how much of a set is owned. */
export function ProgressBar({ owned, total }: { owned: number; total: number }) {
  return (
    <div
      role="progressbar"
      aria-label="Collected"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={owned}
      className="h-2 w-full border-2 border-ink bg-paper"
    >
      <div className="h-full bg-green" style={{ width: `${total ? (owned / total) * 100 : 0}%` }} />
    </div>
  );
}

/** Everything about one pack: art, contents, how much of the set you own, and a big Buy button. */
export function PackDetail({
  pack,
  progress,
  buy,
}: {
  pack: PackDef;
  progress: { owned: number; total: number };
  buy: PackBuy;
}) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <PackArt setId={pack.setId} name={pack.name} className="-rotate-3" />
      <h3 className="font-pixel text-[10px] leading-snug">{pack.name}</h3>
      <p className="font-pixel text-[8px] uppercase opacity-70">{eraLabel(pack.era)}</p>
      <p className="text-xl">{buy.price}</p>
      <p className="text-lg leading-tight">{packContents(pack.setId)}</p>
      <div className="flex w-full flex-col gap-1">
        <p className="text-lg leading-none">
          {progress.owned} / {progress.total} collected
        </p>
        <ProgressBar {...progress} />
      </div>
      <Button className="w-full" aria-label={`Buy ${pack.name}`} disabled={buy.disabled} onClick={buy.onBuy}>
        Buy & open
      </Button>
    </div>
  );
}
