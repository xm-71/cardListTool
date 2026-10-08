import { useState } from 'react';
import type { CardDef, CardInstance } from '@ptcg/engine';
import { defOf } from '../game/view.ts';
import { EnergyDot } from './energy.tsx';
import { usePreview } from './preview.ts';

const SIZES = { xs: 'w-12', sm: 'w-16', md: 'w-24', lg: 'w-64' } as const;
export type CardSize = keyof typeof SIZES;

interface Props {
  card: CardInstance;
  size?: CardSize;
  onClick?: () => void;
  highlighted?: boolean;
  /** Disable hover zoom (e.g. inside the zoom itself). */
  noPreview?: boolean;
}

export function CardView({ card, size = 'md', onClick, highlighted, noPreview }: Props) {
  const def = defOf(card);
  const [failed, setFailed] = useState(false);
  const show = usePreview((s) => s.show);
  const quality = size === 'lg' ? 'high' : 'low';
  const ring = highlighted ? 'ring-4 ring-red' : onClick ? 'hover:ring-4 hover:ring-yellow' : '';
  const body = failed ? (
    <TextCard def={def} compact={size !== 'lg'} />
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
  const className = `${SIZES[size]} aspect-[63/88] shrink-0 rounded-[6%] ${ring} ${onClick ? 'cursor-pointer' : ''}`;
  const hover = noPreview ? {} : { onMouseEnter: () => show(card) };
  return onClick ? (
    <button type="button" className={className} onClick={onClick} data-uid={card.uid} {...hover}>
      {body}
    </button>
  ) : (
    <div className={className} {...hover}>
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
