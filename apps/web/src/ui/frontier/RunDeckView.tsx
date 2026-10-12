import { registry } from '../../game/catalog.ts';
import type { RunCards } from '../../game/frontier/deck.ts';

const GROUPS = [
  { title: 'Pokémon', category: 'Pokemon' },
  { title: 'Trainers', category: 'Trainer' },
  { title: 'Energy', category: 'Energy' },
] as const;

/** The run deck as a list grouped by card kind, with counts. */
export function RunDeckView({ cards }: { cards: RunCards }) {
  return (
    <section aria-label="Run deck" className="retro-box grid gap-4 p-4 sm:grid-cols-3">
      {GROUPS.map((g) => {
        const rows = cards.filter((c) => registry.defs[c.id]?.category === g.category);
        const total = rows.reduce((n, c) => n + c.count, 0);
        return (
          <div key={g.title}>
            <h3 className="mb-2 font-pixel text-[10px]">
              {g.title} ({total})
            </h3>
            <ul className="flex flex-col gap-1 text-lg">
              {rows.map((c) => (
                <li key={c.id} className="flex justify-between gap-2">
                  <span>{registry.defs[c.id]!.name}</span>
                  <span data-testid="deck-count">×{c.count}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
