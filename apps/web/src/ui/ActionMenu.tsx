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
      className="fixed inset-0 z-30 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        role="menu"
        aria-label={title}
        className="retro-box w-full max-w-sm p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 font-pixel text-[10px] uppercase">{title}</div>
        <div className="flex flex-col gap-1">
          {actions.map((a, i) => (
            <button
              key={i}
              role="menuitem"
              type="button"
              className="group relative py-2 pl-7 text-left text-2xl leading-none hover:bg-yellow/40 before:absolute before:left-1 before:font-pixel before:text-xs before:opacity-0 before:content-['▶'] hover:before:opacity-100 focus-visible:before:opacity-100"
              onClick={() => onPick(a)}
            >
              {describeAction(a, view)}
            </button>
          ))}
          <button
            type="button"
            className="mt-1 py-2 pl-7 text-left text-2xl leading-none opacity-80 hover:bg-yellow/40"
            onClick={onDetails}
          >
            Card details
          </button>
          <button
            type="button"
            className="py-2 pl-7 text-left text-2xl leading-none opacity-60 hover:bg-yellow/40"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
