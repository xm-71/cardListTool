import { useState } from 'react';
import type { CardDef, CardInstance } from '@ptcg/engine';
import { defOf } from '../game/view.ts';
import { EnergyDot } from './energy.tsx';
import { useLongPress } from './longPress.ts';
import { usePreview } from './preview.ts';

const SIZES = {
  xs: 'w-12',
  sm: 'w-16',
  md: 'w-24',
  lg: 'w-64',
  // Board sizes: on desktop widths they also shrink with the window height so the board fits without scrolling.
  bench: 'w-16 lg:w-[min(6.5rem,10vh)]',
  active: 'w-24 lg:w-[min(9rem,14vh)]',
  hand: 'w-16 lg:w-[min(5.5rem,8vh)]',
  /** The card shown big in the selection panel. */
  panel: 'w-28 lg:w-[min(6.5rem,12vh)]',
  pile: 'w-12 lg:w-[min(3.5rem,6vh)]',
  /** Attached Energy under a Pokémon. */
  chip: 'w-6 lg:w-[min(1.5rem,3.2vh)]',
  // Face-off board (phones): widths come from CSS variables set on the board.
  foBench: 'w-[var(--fo-bench)]',
  foOpp: 'w-[var(--fo-opp)]',
  foYou: 'w-[var(--fo-you)]',
  foHand: 'w-[var(--fo-hand)]',
} as const;
export type CardSize = keyof typeof SIZES;

interface Props {
  card: CardInstance;
  size?: CardSize;
  onClick?: () => void;
  highlighted?: boolean;
  /** The card the player has picked. */
  selected?: boolean;
  /** Disable long-press zoom (e.g. inside the zoom itself). */
  noPreview?: boolean;
  /** A spot the card the player is holding can be played onto: it glows. */
  target?: boolean;
}

export function CardView({ card, size = 'md', onClick, highlighted, selected, noPreview, target }: Props) {
  const def = defOf(card);
  const [failed, setFailed] = useState(false);
  const zoom = usePreview((s) => s.zoom);
  const press = useLongPress(() => zoom(card));
  const quality = size === 'lg' || size === 'panel' ? 'high' : 'low';
  const ring = target
    ? 'ring-4 ring-yellow shadow-[0_0_14px_4px_var(--color-yellow)] motion-safe:animate-pulse'
    : selected
      ? 'ring-4 ring-yellow'
      : highlighted
        ? 'ring-4 ring-red'
        : onClick
          ? 'hover:ring-4 hover:ring-yellow'
          : '';
  // A tiny Energy card that can't load is shown as its coloured dot.
  if (failed && size === 'chip' && def.category === 'Energy') {
    return <EnergyDot type={def.provides[0] ?? 'Colorless'} title={def.name} />;
  }
  const body = failed ? (
    <TextCard def={def} compact={size !== 'lg' && size !== 'panel'} />
  ) : (
    <img
      src={`${def.image}/${quality}.webp`}
      alt={def.name}
      loading="lazy"
      draggable={false}
      onError={() => setFailed(true)}
      className="h-full w-full rounded-[6%] object-cover"
    />
  );
  // Press and hold a card to look at it full size (no hover on a phone).
  const hold = noPreview ? '' : ' select-none [-webkit-touch-callout:none]';
  const className = `${SIZES[size]} aspect-[63/88] shrink-0 rounded-[6%] ${ring} ${onClick ? 'cursor-pointer' : ''}${hold}`;
  const hover = noPreview ? {} : press.handlers;
  const click = onClick
    ? () => {
        if (!noPreview && press.consumeClick()) return;
        onClick();
      }
    : undefined;
  return onClick ? (
    <button
      type="button"
      className={className}
      onClick={click}
      data-uid={card.uid}
      data-target={target ? '' : undefined}
      {...hover}
    >
      {body}
    </button>
  ) : (
    <div className={className} data-uid={card.uid} {...hover}>
      {body}
    </div>
  );
}

/** Text rendering of a card, used when its image can't be loaded. */
export function TextCard({ def, compact }: { def: CardDef; compact?: boolean }) {
  const text = compact ? 'text-[8px] leading-tight' : 'text-xs';
  return (
    <div
      className={`flex h-full w-full flex-col gap-0.5 overflow-hidden rounded-[6%] border border-slate-400 bg-slate-100 p-1 text-left text-slate-900 ${text}`}
    >
      <div className="flex items-start justify-between gap-1 font-bold">
        <span>{def.name}</span>
        {def.category === 'Pokemon' && <span className="shrink-0">{def.hp} HP</span>}
      </div>
      {def.category === 'Pokemon' && (
        <>
          <div className="italic text-slate-600">
            {def.stage}
            {def.evolvesFrom ? ` · from ${def.evolvesFrom}` : ''}
          </div>
          {def.abilities.map((a) => (
            <div key={a.name}>
              <b className="text-red-700">Ability: {a.name}</b>
              {!compact && <span> — {a.text}</span>}
            </div>
          ))}
          {def.attacks.map((a) => (
            <div key={a.name} className="flex flex-wrap items-center gap-0.5">
              {a.cost.map((c, i) => (
                <EnergyDot key={i} type={c} />
              ))}
              <b>{a.name}</b>
              {a.damage > 0 && (
                <span>
                  {a.damage}
                  {a.damageSuffix}
                </span>
              )}
              {!compact && a.text && <span className="w-full text-slate-700">{a.text}</span>}
            </div>
          ))}
        </>
      )}
      {def.category === 'Trainer' && (
        <>
          <div className="italic text-slate-600">{def.trainerType}</div>
          {!compact && <div>{def.text}</div>}
        </>
      )}
      {def.category === 'Energy' && <div className="italic text-slate-600">{def.energyKind} Energy</div>}
    </div>
  );
}
