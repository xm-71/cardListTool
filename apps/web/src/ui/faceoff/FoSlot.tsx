import type { EnergyType, SlotView } from '@ptcg/engine';
import { defOf, topCard, topDef } from '../../game/view.ts';
import { CardView } from '../CardView.tsx';
import { EnergyDot } from '../energy.tsx';
import { HpBar } from '../retro/index.ts';

const CONDITION = { asleep: 'Asleep', confused: 'Confused', paralyzed: 'Paralyzed' } as const;

interface Props {
  slot: SlotView;
  size: 'foBench' | 'foOpp' | 'foYou';
  onClick(): void;
  target?: boolean;
  highlighted?: boolean;
  selected?: boolean;
}

/** A Pokémon on the Face-off board: the card, Energy pips along its lower edge, conditions, and HP underneath. */
export function FoSlot({ slot, size, onClick, target, highlighted, selected }: Props) {
  const def = topDef(slot);
  const max = slot.hp ?? def.hp;
  const left = Math.max(0, max - slot.damage);
  const small = size === 'foBench';
  const conditions = [
    ...(slot.conditions.rotation !== 'none' ? [CONDITION[slot.conditions.rotation]] : []),
    ...(slot.conditions.poisoned ? ['Poisoned'] : []),
    ...(slot.conditions.burned ? ['Burned'] : []),
  ];
  const energy = slot.energy.flatMap((e) => {
    const d = defOf(e);
    return d.category === 'Energy'
      ? [{ uid: e.uid, type: (d.provides[0] ?? 'Colorless') as EnergyType, name: d.name }]
      : [];
  });
  // HP sits under the big cards, and over the lower edge of the small Bench cards to keep the board short.
  const hp = (
    <div
      className={`flex w-full items-center gap-1 border-2 border-ink bg-paper-fixed px-0.5 font-pixel text-ink-fixed ${small ? 'pointer-events-none absolute inset-x-0 bottom-0 text-[6px]' : 'text-[8px]'}`}
    >
      <span className={slot.damage > 0 ? 'text-red' : ''}>{left}</span>
      <div className="min-w-0 flex-1">
        <HpBar hp={left} max={max} />
      </div>
    </div>
  );
  return (
    <div data-slot-id={slot.stack[0]!.uid} className="flex flex-col items-center gap-0.5">
      <div className="relative">
        <CardView
          card={topCard(slot)}
          size={size}
          onClick={onClick}
          target={target}
          highlighted={highlighted}
          selected={selected}
        />
        {energy.length > 0 && (
          <div
            className={`pointer-events-none absolute inset-x-0.5 flex flex-wrap gap-px ${small ? 'bottom-4 origin-bottom-left scale-75' : 'bottom-0.5'}`}
          >
            {energy.map((e) => (
              <EnergyDot key={e.uid} type={e.type} title={e.name} />
            ))}
          </div>
        )}
        {conditions.length > 0 && (
          <div className="pointer-events-none absolute top-1 left-1 flex flex-col gap-0.5">
            {conditions.map((c) => (
              <span
                key={c}
                className="border-2 border-ink bg-purple px-0.5 font-pixel text-[5px] uppercase text-paper-fixed"
              >
                {small ? c.slice(0, 3) : c}
              </span>
            ))}
          </div>
        )}
        {slot.tool && (
          <span
            title={defOf(slot.tool).name}
            className="pointer-events-none absolute -top-1 right-0 max-w-full truncate border-2 border-ink bg-blue px-0.5 text-xs leading-tight text-paper-fixed"
          >
            {small ? 'Tool' : defOf(slot.tool).name}
          </span>
        )}
        {small && hp}
      </div>
      {!small && hp}
    </div>
  );
}
