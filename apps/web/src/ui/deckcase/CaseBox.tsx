import { registry } from '../../game/catalog.ts';
import type { CaseEntry } from '../../game/deckCase.ts';

/** One deck in the Deck Case: its cover, name and type, with ACTIVE, format and problem notes. */
export function CaseBox({
  entry,
  selected,
  onOpen,
}: {
  entry: CaseEntry;
  selected: boolean;
  onOpen(): void;
}) {
  return (
    <button
      type="button"
      aria-label={`View ${entry.name}`}
      aria-pressed={selected}
      onClick={onOpen}
      className={`flex flex-col items-center gap-2 border-4 border-ink p-2 text-center ${selected ? 'retro-shadow bg-yellow text-ink-fixed' : 'bg-paper hover:bg-cream'} ${entry.problem ? 'opacity-60' : ''}`}
    >
      <img src={`${registry.defs[entry.cover]!.image}/low.webp`} alt="" className="w-20" />
      <span className="font-pixel text-[8px] leading-relaxed">{entry.name}</span>
      {entry.type && <span className="text-lg leading-none">{entry.type}</span>}
      <span className="flex flex-wrap justify-center gap-1">
        {entry.active && (
          <span className="border-2 border-ink-fixed bg-green px-1 py-0.5 font-pixel text-[8px] text-ink-fixed">
            ACTIVE
          </span>
        )}
        {entry.format && (
          <span
            className={`border-2 border-ink px-1 py-0.5 font-pixel text-[8px] uppercase ${entry.format === 'gym' ? 'bg-purple text-paper-fixed' : 'bg-paper text-ink'}`}
          >
            {entry.format === 'gym' ? 'Gym only' : 'Standard'}
          </span>
        )}
      </span>
      {entry.problem && <span className="text-base leading-tight">{entry.problem}</span>}
    </button>
  );
}
