import { useState } from 'react';
import { ERAS } from '../game/catalog.ts';

type EraId = (typeof ERAS)[number]['id'];

/**
 * Era chips ("All" plus one per era that has entries) in one row that scrolls sideways, and a search box,
 * for the Shop and the Binder. On a phone the box opens from a Search button; on wider screens it is always there.
 */
export function EraFilter({
  eras,
  era,
  onEra,
  query,
  onQuery,
  searchLabel,
}: {
  /** Eras that have something to show. */
  eras: readonly EraId[];
  era: EraId | 'all';
  onEra: (era: EraId | 'all') => void;
  query: string;
  onQuery: (query: string) => void;
  searchLabel: string;
}) {
  const [searching, setSearching] = useState(query !== '');
  const chip = (active: boolean) =>
    `shrink-0 border-4 border-ink px-2 py-1.5 font-pixel text-[8px] uppercase sm:px-2.5 ${active ? 'retro-shadow bg-yellow text-ink-fixed' : 'bg-paper hover:bg-cream'}`;
  return (
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-1 [mask-image:linear-gradient(90deg,#000_92%,transparent)] sm:flex-wrap sm:overflow-visible sm:pb-0 sm:[mask-image:none]">
        <button
          type="button"
          aria-pressed={era === 'all'}
          onClick={() => onEra('all')}
          className={chip(era === 'all')}
        >
          All
        </button>
        {ERAS.filter((e) => eras.includes(e.id)).map((e) => (
          <button
            key={e.id}
            type="button"
            aria-label={e.label}
            aria-pressed={era === e.id}
            onClick={() => onEra(e.id)}
            className={chip(era === e.id)}
          >
            <span className={e.short === e.label ? '' : 'hidden sm:inline'}>{e.label}</span>
            {e.short !== e.label && <span className="sm:hidden">{e.short}</span>}
          </button>
        ))}
        <button
          type="button"
          aria-expanded={searching}
          onClick={() => setSearching((open) => !open)}
          className={`${chip(searching)} sm:hidden`}
        >
          Search
        </button>
      </div>
      <div className={`${searching ? 'block' : 'hidden'} sm:block`}>
        <input
          type="search"
          aria-label={searchLabel}
          placeholder={searchLabel}
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          className="w-full border-4 border-ink bg-paper px-3 py-1 text-xl sm:w-52"
        />
      </div>
    </div>
  );
}

/** Case-insensitive "contains" match used by the filters. */
export const matchesQuery = (name: string, query: string): boolean =>
  name.toLowerCase().includes(query.trim().toLowerCase());
