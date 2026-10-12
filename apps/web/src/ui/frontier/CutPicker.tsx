import { useMemo, useState } from 'react';
import type { EnergyType } from '@ptcg/engine';
import { registry } from '../../game/catalog.ts';
import { applyChange, runDeckProblems, type RunCards } from '../../game/frontier/deck.ts';
import { BASIC_ENERGY } from '../../game/frontier/run.ts';
import { Button } from '../retro/index.ts';

interface Props {
  deck: RunCards;
  add: RunCards;
  /** Cards to cut: exactly this many, or (Tune-up) up to this many. */
  count: number;
  tuneup?: boolean;
  onConfirm(cut: RunCards, energyTypes?: EnergyType[]): void;
  onCancel(): void;
}

const TYPES = Object.keys(BASIC_ENERGY) as EnergyType[];
const GROUPS = [
  { title: 'Pokémon', category: 'Pokemon' },
  { title: 'Trainers', category: 'Trainer' },
  { title: 'Energy', category: 'Energy' },
] as const;

/** Pick the cards that leave the run deck; Confirm only when the count is right and the deck stays legal. */
export function CutPicker({ deck, add, count, tuneup = false, onConfirm, onCancel }: Props) {
  const merged = useMemo(() => applyChange(deck, add, []), [deck, add]);
  const [cut, setCut] = useState<Record<string, number>>({});
  const total = Object.values(cut).reduce((a, b) => a + b, 0);
  const [types, setTypes] = useState<EnergyType[]>([]);
  const energyTypes = Array.from({ length: tuneup ? total : 0 }, (_, i) => types[i] ?? 'Grass');
  const cutCards = Object.entries(cut)
    .filter(([, n]) => n > 0)
    .map(([id, n]) => ({ id, count: n }));
  const added = tuneup ? energyTypes.map((t) => ({ id: BASIC_ENERGY[t]!, count: 1 })) : add;
  const sizeOk = tuneup ? total <= count : total === count;
  const problems = sizeOk ? runDeckProblems(applyChange(deck, added, cutCards), registry) : [];
  const ready = sizeOk && problems.length === 0;
  const change = (id: string, by: number) => setCut((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) + by) }));

  return (
    <section aria-label="Cut cards" className="retro-box flex flex-col gap-4 p-4">
      <h2 className="font-pixel text-xs uppercase">{tuneup ? 'Tune-up' : 'Make room'}</h2>
      <p className="text-xl">
        {tuneup
          ? `Cut up to ${count} cards; each becomes a basic Energy of your choice. Cut ${total} so far.`
          : `Your deck must stay at 60 cards: cut ${count}. Cut ${total} so far.`}
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <h3 className="mb-2 font-pixel text-[10px]">{g.title}</h3>
            <ul className="flex flex-col gap-1">
              {merged
                .filter((c) => registry.defs[c.id]?.category === g.category)
                .map((c) => {
                  const name = registry.defs[c.id]!.name;
                  const n = cut[c.id] ?? 0;
                  return (
                    <li key={c.id} className="flex items-center justify-between gap-2 text-lg">
                      <span className="min-w-0 flex-1 truncate">
                        {name} ×{c.count - n}
                        {n > 0 && <span className="text-red-fg"> (−{n})</span>}
                      </span>
                      <Button
                        variant="plain"
                        aria-label={`Keep ${name}`}
                        disabled={n === 0}
                        onClick={() => change(c.id, -1)}
                      >
                        Undo
                      </Button>
                      <Button
                        variant="plain"
                        aria-label={`Cut ${name}`}
                        disabled={n >= c.count || total >= count}
                        onClick={() => change(c.id, 1)}
                      >
                        Cut
                      </Button>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </div>
      {tuneup && total > 0 && (
        <div className="flex flex-wrap gap-3">
          {energyTypes.map((t, i) => (
            <label key={i} className="flex items-center gap-2 text-lg">
              New Energy {i + 1}
              <select
                aria-label={`Energy ${i + 1}`}
                value={t}
                className="border-4 border-ink bg-paper px-2"
                onChange={(e) =>
                  setTypes((prev) => {
                    const next = [...energyTypes];
                    next[i] = e.target.value as EnergyType;
                    return prev.length > next.length ? next.concat(prev.slice(next.length)) : next;
                  })
                }
              >
                {TYPES.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}
      {problems.length > 0 && (
        <p role="alert" className="text-xl text-red-fg">
          {problems.join('. ')}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button disabled={!ready} onClick={() => onConfirm(cutCards, tuneup ? energyTypes : undefined)}>
          Confirm cut
        </Button>
        <Button variant="plain" onClick={onCancel}>
          Back
        </Button>
      </div>
    </section>
  );
}
