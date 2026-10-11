import { useEffect } from 'react';
import type { EnergyType } from '@ptcg/engine';
import { EnergyDot } from '../energy.tsx';

export interface MenuItem {
  label: string;
  /** Attack cost, shown as Energy dots. */
  cost?: EnergyType[];
  disabled?: boolean;
  onClick(): void;
}

/** What can be done with a Pokémon (or the Stadium): a small menu over the board. Tap outside or Escape to close. */
export function ActionMenu({ title, items, onClose }: { title: string; items: MenuItem[]; onClose(): void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      data-testid="menu-backdrop"
      className="absolute inset-0 z-30 flex items-end justify-center bg-ink-fixed/30 px-4 pb-[calc(var(--fo-hand)*1.2+1rem)]"
      onClick={onClose}
    >
      <div
        role="menu"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="retro-box flex w-[min(20rem,100%)] flex-col gap-1.5 p-3"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-pixel text-[9px] uppercase">{title}</span>
          <button type="button" aria-label="Close" onClick={onClose} className="px-2 font-pixel text-[10px]">
            ×
          </button>
        </div>
        {items.map((it, i) => (
          <button
            key={i}
            role="menuitem"
            type="button"
            aria-label={it.label}
            disabled={it.disabled}
            onClick={it.onClick}
            className="flex w-full items-center gap-2 border-2 border-ink bg-paper px-2 py-2 text-left text-xl leading-tight hover:bg-yellow/40 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-paper"
          >
            {it.cost && (
              <span className="flex shrink-0 gap-0.5">
                {it.cost.map((c, k) => (
                  <EnergyDot key={k} type={c} />
                ))}
              </span>
            )}
            <span className="flex-1">{it.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
