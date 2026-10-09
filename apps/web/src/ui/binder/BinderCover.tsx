import { cardCount } from '../../profile/binders.ts';
import type { CustomBinder, StickerSpot } from '../../profile/types.ts';
import { Background, COLOR_VAR, Sticker } from './art.tsx';

const SPOT_CLASS: Record<StickerSpot, string> = {
  topLeft: 'left-2 top-2 -rotate-12',
  topRight: 'right-2 top-2 rotate-12',
  bottomLeft: 'bottom-2 left-2 rotate-6',
  bottomRight: 'bottom-2 right-2 -rotate-6',
};

/** A binder's front cover: colour, pattern, stickers, name label and card count. */
export function BinderCover({ binder, size = 'sm' }: { binder: CustomBinder; size?: 'sm' | 'lg' }) {
  const n = cardCount(binder);
  const big = size === 'lg';
  return (
    <div
      data-testid="binder-cover"
      data-color={binder.coverColor}
      data-background={binder.background}
      className={`retro-shadow relative flex aspect-[3/4] flex-col items-center justify-center overflow-hidden rounded-r-lg border-4 border-ink ${big ? 'w-56' : 'w-36'}`}
      style={{ background: COLOR_VAR[binder.coverColor] }}
    >
      <Background kind={binder.background} color={binder.coverColor} />
      <div aria-hidden className="absolute inset-y-0 left-0 w-3 border-r-4 border-ink bg-ink/40" />
      {Object.entries(binder.stickers).map(([spot, id]) => (
        <span key={spot} className={`absolute ${SPOT_CLASS[spot as StickerSpot]}`}>
          <Sticker id={id} size={big ? 40 : 28} />
        </span>
      ))}
      <div className="relative z-10 mx-5 flex flex-col items-center gap-1 border-4 border-ink bg-paper px-2 py-2 text-center">
        <span className={`font-pixel leading-relaxed break-words ${big ? 'text-[11px]' : 'text-[8px]'}`}>
          {binder.name}
        </span>
        <span className="text-lg leading-none">{n === 1 ? '1 card' : `${n} cards`}</span>
      </div>
    </div>
  );
}
