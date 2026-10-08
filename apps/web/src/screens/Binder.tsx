import { useMemo, useState } from 'react';
import type { CardInstance } from '@ptcg/engine';
import { isPlayable, SETS, setCards } from '@ptcg/cards';
import { registry } from '../game/catalog.ts';
import { useProfile } from '../profile/useProfile.ts';
import { CardDetails } from '../ui/CardDetails.tsx';
import { CardView } from '../ui/CardView.tsx';

export const cardNumber = (id: string): string => id.slice(id.lastIndexOf('-') + 1);

export function Binder() {
  const collection = useProfile((s) => s.profile.collection);
  const [setId, setSetId] = useState(SETS[0]!.id);
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [playableOnly, setPlayableOnly] = useState(false);
  const [details, setDetails] = useState<CardInstance | null>(null);
  const cards = useMemo(
    () => setCards(setId).map((def) => ({ def, playable: isPlayable(def, registry) })),
    [setId],
  );
  const shown = cards.filter(
    ({ def, playable }) => (!ownedOnly || (collection[def.id] ?? 0) > 0) && (!playableOnly || playable),
  );
  const ownedCount = cards.filter(({ def }) => (collection[def.id] ?? 0) > 0).length;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {SETS.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={s.id === setId}
            onClick={() => setSetId(s.id)}
            className={`rounded-lg px-3 py-1.5 ${s.id === setId ? 'bg-amber-400/20 ring-2 ring-amber-400' : 'bg-white/5 hover:bg-white/10'}`}
          >
            {s.name}
          </button>
        ))}
        <span className="text-sm text-white/60">
          {ownedCount} / {cards.length} collected
        </span>
        <label className="ml-auto flex items-center gap-2 text-sm">
          <input type="checkbox" checked={ownedOnly} onChange={(e) => setOwnedOnly(e.target.checked)} /> Owned
          only
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={playableOnly} onChange={(e) => setPlayableOnly(e.target.checked)} />{' '}
          Playable only
        </label>
      </div>
      <ul aria-label="Cards" className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-3">
        {shown.map(({ def, playable }) => {
          const count = collection[def.id] ?? 0;
          const card = { uid: `binder-${def.id}`, defId: def.id, owner: 0 as const };
          return (
            <li
              key={def.id}
              aria-label={`${def.name} #${cardNumber(def.id)}`}
              data-owned={count > 0}
              className={`flex flex-col items-center gap-1 ${count > 0 ? '' : 'opacity-35 grayscale'}`}
            >
              <CardView card={card} size="md" noPreview onClick={() => setDetails(card)} />
              <div className="flex items-center gap-1 text-xs">
                <span className="text-white/50">#{cardNumber(def.id)}</span>
                {count > 0 ? (
                  <span className="font-semibold">×{count}</span>
                ) : (
                  <span className="sr-only">Not owned</span>
                )}
                {playable && (
                  <span className="rounded bg-emerald-500/30 px-1 text-emerald-100">Playable</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {shown.length === 0 && <p className="text-white/60">No cards match these filters yet.</p>}
      {details && <CardDetails card={details} onClose={() => setDetails(null)} />}
    </section>
  );
}
