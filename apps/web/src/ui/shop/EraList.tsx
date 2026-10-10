import { ERAS } from '../../game/catalog.ts';

type EraId = (typeof ERAS)[number]['id'];

/** The desktop Shop's era list: "All" plus each era with its number of packs, and a search box. */
export function EraList({
  counts,
  total,
  era,
  onEra,
  query,
  onQuery,
}: {
  counts: Readonly<Partial<Record<EraId, number>>>;
  total: number;
  era: EraId | 'all';
  onEra(era: EraId | 'all'): void;
  query: string;
  onQuery(query: string): void;
}) {
  const row = (active: boolean) =>
    `flex items-center justify-between gap-2 border-2 border-ink px-2 py-1.5 text-left text-xl leading-none ${active ? 'bg-yellow' : 'bg-paper hover:bg-cream'}`;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="mb-1 font-pixel text-[8px] uppercase">Eras</span>
      <button
        type="button"
        aria-label="All"
        aria-pressed={era === 'all'}
        onClick={() => onEra('all')}
        className={row(era === 'all')}
      >
        <span>All</span>
        <span className="opacity-60">{total}</span>
      </button>
      {ERAS.filter((e) => counts[e.id]).map((e) => (
        <button
          key={e.id}
          type="button"
          aria-label={e.label}
          aria-pressed={era === e.id}
          onClick={() => onEra(e.id)}
          className={row(era === e.id)}
        >
          <span>{e.label}</span>
          <span className="opacity-60">{counts[e.id]}</span>
        </button>
      ))}
      <input
        type="search"
        aria-label="Search packs"
        placeholder="Search packs"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        className="mt-2 w-full border-4 border-ink bg-paper px-2 py-1 text-xl"
      />
    </div>
  );
}
