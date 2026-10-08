import type { SlotView as SlotViewData } from '@ptcg/engine';
import { defOf, topCard, topDef } from '../game/view.ts';
import { CardView, type CardSize } from './CardView.tsx';
import { EnergyDot } from './energy.tsx';

const ROTATION_LABEL = { asleep: 'Asleep', confused: 'Confused', paralyzed: 'Paralyzed' } as const;

interface Props {
  slot: SlotViewData;
  size?: CardSize;
  onClick?: () => void;
  highlighted?: boolean;
}

/** A Pokémon in play: its card, HP left, attached Energy and Tool, and Special Conditions. */
export function SlotView({ slot, size = 'md', onClick, highlighted }: Props) {
  const def = topDef(slot);
  const hpLeft = Math.max(0, def.hp - slot.damage);
  const badges = [
    ...(slot.conditions.rotation !== 'none' ? [ROTATION_LABEL[slot.conditions.rotation]] : []),
    ...(slot.conditions.poisoned ? ['Poisoned'] : []),
    ...(slot.conditions.burned ? ['Burned'] : []),
  ];
  return (
    <div className="relative flex flex-col items-center gap-1">
      <div className="relative">
        <CardView card={topCard(slot)} size={size} onClick={onClick} highlighted={highlighted} />
        <span
          className={`absolute -top-2 -right-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold shadow ${
            slot.damage > 0 ? 'bg-red-600 text-white' : 'bg-white/90 text-slate-900'
          }`}
        >
          {hpLeft}/{def.hp}
        </span>
        {badges.length > 0 && (
          <div className="absolute bottom-1 left-1 flex flex-col gap-0.5">
            {badges.map((b) => (
              <span key={b} className="rounded bg-fuchsia-700 px-1 text-[9px] font-semibold text-white">
                {b}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex min-h-4 flex-wrap justify-center gap-0.5">
        {slot.energy.map((e) => {
          const d = defOf(e);
          return d.category === 'Energy' ? (
            <EnergyDot key={e.uid} type={d.provides[0] ?? 'Colorless'} title={d.name} />
          ) : null;
        })}
      </div>
      {slot.tool && <span className="rounded bg-sky-800 px-1 text-[9px]">{defOf(slot.tool).name}</span>}
    </div>
  );
}
