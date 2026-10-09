import { useMemo, useState } from 'react';
import { SETS } from '@ptcg/cards';
import { registry } from '../../game/catalog.ts';
import { placementsLeft } from '../../profile/binders.ts';
import type { CustomBinder } from '../../profile/types.ts';
import { useProfile } from '../../profile/useProfile.ts';
import { Button } from '../retro/index.ts';

const setOf = (id: string) => id.slice(0, id.lastIndexOf('-'));
const SET_ORDER = new Map(SETS.map((s, i) => [s.id, i]));

/** Dialog listing the player's owned cards; a card with every copy already in this binder is disabled. */
export function CardPicker({
  binder,
  current,
  onPick,
  onClose,
}: {
  binder: CustomBinder;
  /** The card already in the slot being filled (it can be picked again). */
  current: string | null;
  onPick(cardId: string): void;
  onClose(): void;
}) {
  const collection = useProfile((s) => s.profile.collection);
  const [query, setQuery] = useState('');
  const [setId, setSetId] = useState('');
  const owned = useMemo(
    () =>
      Object.keys(collection)
        .filter((id) => (collection[id] ?? 0) > 0 && registry.defs[id])
        .sort(
          (a, b) =>
            (SET_ORDER.get(setOf(a)) ?? 99) - (SET_ORDER.get(setOf(b)) ?? 99) ||
            a.localeCompare(b, 'en', { numeric: true }),
        ),
    [collection],
  );
  const q = query.trim().toLowerCase();
  const shown = owned.filter(
    (id) => (!setId || setOf(id) === setId) && (!q || registry.defs[id]!.name.toLowerCase().includes(q)),
  );
  const ownedSets = SETS.filter((s) => owned.some((id) => setOf(id) === s.id));

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose a card"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        className="retro-box flex max-h-full w-full max-w-3xl flex-col gap-3 p-4"
      >
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-pixel text-xs uppercase">Choose a card</h2>
          <input
            aria-label="Search cards"
            placeholder="Search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-0 flex-1 border-b-4 border-ink bg-transparent px-1 text-xl outline-none"
          />
          <select
            aria-label="Set"
            value={setId}
            onChange={(e) => setSetId(e.target.value)}
            className="border-4 border-ink bg-paper px-1 text-lg"
          >
            <option value="">All sets</option>
            {ownedSets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <ul className="grid min-h-0 grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2 overflow-y-auto">
          {shown.map((id) => {
            const def = registry.defs[id]!;
            const left = placementsLeft(binder, id, collection) + (current === id ? 1 : 0);
            return (
              <li key={id}>
                <button
                  type="button"
                  aria-label={def.name}
                  disabled={left === 0}
                  onClick={() => onPick(id)}
                  className="flex w-full flex-col items-center gap-1 p-1 hover:bg-yellow/40 disabled:cursor-not-allowed disabled:opacity-35 disabled:grayscale"
                >
                  <img src={`${def.image}/low.webp`} alt="" loading="lazy" className="w-full rounded" />
                  <span className="text-base leading-none">{left} left</span>
                </button>
              </li>
            );
          })}
        </ul>
        {owned.length === 0 && (
          <p className="text-xl">You don't own any cards yet. Open some packs in the Shop!</p>
        )}
        {owned.length > 0 && shown.length === 0 && <p className="text-xl">No owned cards match.</p>}
        <Button variant="plain" className="self-end" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
