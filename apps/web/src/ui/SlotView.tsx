import type { SlotView as SlotViewData } from '@ptcg/engine';
import { defOf, topCard, topDef } from '../game/view.ts';
import { CardView, type CardSize } from './CardView.tsx';
import { HpBar } from './retro/index.ts';

const ROTATION_LABEL = { asleep: 'Asleep', confused: 'Confused', paralyzed: 'Paralyzed' } as const;

interface Props {
  slot: SlotViewData;
  size?: CardSize;
  onClick?: () => void;
  highlighted?: boolean;
  selected?: boolean;
}

/** A Pokémon in play: its card, HP left, attached Energy and Tool, and Special Conditions. */
export function SlotView({ slot, size = 'md', onClick, highlighted, selected }: Props) {
  const def = topDef(slot);
  const hp = slot.hp ?? def.hp; // effective max HP (e.g. Gravity Mountain), when the view provides it
  const hpLeft = Math.max(0, hp - slot.damage);
  const badges = [
    ...(slot.conditions.rotation !== 'none' ? [ROTATION_LABEL[slot.conditions.rotation]] : []),
    ...(slot.conditions.poisoned ? ['Poisoned'] : []),
    ...(slot.conditions.burned ? ['Burned'] : []),
  ];
  return (
    <div data-slot-id={slot.stack[0]!.uid} className="relative flex flex-col items-center gap-1">
      <div className="relative">
        <CardView
          card={topCard(slot)}
          size={size}
          onClick={onClick}
          highlighted={highlighted}
          selected={selected}
        />
        <div className="absolute -top-3 -right-3 w-16 border-2 border-ink bg-paper px-1 py-0.5 font-pixel text-[7px] leading-tight lg:-right-1 lg:w-[calc(100%+0.5rem)] lg:text-[6px]">
          <span className={slot.damage > 0 ? 'text-red-fg' : ''}>
            {hpLeft}/{hp}
          </span>
          <HpBar hp={hpLeft} max={hp} />
        </div>
        {badges.length > 0 && (
          <div className="absolute bottom-1 left-1 flex flex-col gap-0.5">
            {badges.map((b) => (
              <span
                key={b}
                className="border-2 border-ink bg-purple px-1 font-pixel text-[6px] uppercase text-paper-fixed"
              >
                {b}
              </span>
            ))}
          </div>
        )}
      </div>
      {/* Energy and Tool sit over the card's lower edge so the board keeps a fixed height. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0.5 flex flex-col items-center gap-0.5">
        <div className="flex flex-wrap justify-center gap-0.5">
          {slot.energy.map((e) =>
            defOf(e).category === 'Energy' ? (
              // The container ignores the pointer (it sits over the card), the Energy cards don't.
              <span key={e.uid} className="pointer-events-auto" title={defOf(e).name}>
                <CardView card={e} size="chip" />
              </span>
            ) : null,
          )}
        </div>
        {slot.tool && (
          <span
            title={defOf(slot.tool).name}
            className="max-w-full truncate border-2 border-ink bg-blue px-1 text-sm leading-tight text-paper-fixed"
          >
            {defOf(slot.tool).name}
          </span>
        )}
      </div>
    </div>
  );
}
