import type { Action, PlayerView } from '@ptcg/engine';
import { describeAction } from '../game/actions.ts';

interface Props {
  title: string;
  actions: Action[];
  view: PlayerView;
  onPick(action: Action): void;
  onDetails(): void;
  onClose(): void;
}

/** Popup listing what can be done with the clicked card or Pokémon. */
export function ActionMenu({ title, actions, view, onPick, onDetails, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/30 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        role="menu"
        aria-label={title}
        className="w-full max-w-sm rounded-xl bg-slate-900 p-3 shadow-2xl ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 text-sm font-semibold text-white/70">{title}</div>
        <div className="flex flex-col gap-1">
          {actions.map((a, i) => (
            <button
              key={i}
              role="menuitem"
              type="button"
              className="rounded-lg bg-white/10 px-3 py-2 text-left hover:bg-amber-400 hover:text-slate-900"
              onClick={() => onPick(a)}
            >
              {describeAction(a, view)}
            </button>
          ))}
          <button
            type="button"
            className="mt-1 rounded-lg px-3 py-2 text-left text-white/70 hover:bg-white/5"
            onClick={onDetails}
          >
            Card details
          </button>
          <button
            type="button"
            className="rounded-lg px-3 py-2 text-left text-white/60 hover:bg-white/5"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
