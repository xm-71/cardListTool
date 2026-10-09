import { ERAS } from '../game/catalog.ts';

type EraId = (typeof ERAS)[number]['id'];

/** Era chips ("All" plus one per era that has entries) and a search box, for the Shop and the Binder. */
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
  const chip = (active: boolean) =>
    `border-4 border-ink px-3 py-2 font-pixel text-[9px] uppercase ${active ? 'retro-shadow bg-yellow' : 'bg-paper hover:bg-cream'}`;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={era === 'all'} onClick={() => onEra('all')} className={chip(era === 'all')}>
          All
        </button>
        {ERAS.filter((e) => eras.includes(e.id)).map((e) => (
          <button
            key={e.id}
            type="button"
            aria-pressed={era === e.id}
            onClick={() => onEra(e.id)}
            className={chip(era === e.id)}
          >
            {e.label}
          </button>
        ))}
      </div>
      <input
        type="search"
        aria-label={searchLabel}
        placeholder={searchLabel}
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        className="w-full max-w-sm border-4 border-ink bg-paper px-3 py-2 text-xl"
      />
    </div>
  );
}

/** Case-insensitive "contains" match used by the filters. */
export const matchesQuery = (name: string, query: string): boolean =>
  name.toLowerCase().includes(query.trim().toLowerCase());
