import { useMemo, useState } from 'react';
import type { CardDef, DeckList } from '@ptcg/engine';
import { isPlayable } from '@ptcg/cards';
import { DECK_SIZE, MAX_COPIES, validateCustomDeck } from '@ptcg/economy';
import { registry } from '../game/catalog.ts';
import { useProfile } from '../profile/useProfile.ts';
import type { CustomDeck } from '../profile/types.ts';
import { cardNumber } from './Binder.tsx';

const isBasicEnergy = (def: CardDef): boolean => def.category === 'Energy' && def.energyKind === 'Basic';
const BASIC_ENERGY = Object.values(registry.defs)
  .filter(isBasicEnergy)
  .sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
const CATEGORY_ORDER = { Pokemon: 0, Trainer: 1, Energy: 2 } as const;
const byCategoryThenId = (a: CardDef, b: CardDef): number =>
  CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category] ||
  a.id.localeCompare(b.id, 'en', { numeric: true });

const newId = (): string => `deck-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function DeckBuilder() {
  const decks = useProfile((s) => s.profile.decks);
  const deleteDeck = useProfile((s) => s.deleteDeck);
  const [editing, setEditing] = useState<CustomDeck | null>(null);

  if (editing) return <Editor initial={editing} onClose={() => setEditing(null)} />;
  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold">Your decks</h2>
        <button
          type="button"
          onClick={() => setEditing({ id: newId(), name: 'New deck', cards: [] })}
          className="ml-auto rounded-lg bg-amber-400 px-4 py-2 font-semibold text-slate-900 hover:bg-amber-300"
        >
          New deck
        </button>
      </div>
      <p className="text-sm text-white/60">
        Build decks from cards you own that the game can play. Basic Energy is free. Starter decks are always
        available on the Home screen.
      </p>
      {decks.length === 0 ? (
        <p className="text-white/60">No custom decks yet.</p>
      ) : (
        <ul aria-label="Saved decks" className="flex flex-col gap-2">
          {decks.map((d) => (
            <li key={d.id} className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-2">
              <span className="font-semibold">{d.name}</span>
              <span className="text-sm text-white/50">{d.cards.reduce((n, c) => n + c.count, 0)} cards</span>
              <button
                type="button"
                aria-label={`Edit ${d.name}`}
                onClick={() => setEditing(d)}
                className="ml-auto rounded-lg bg-white/10 px-3 py-1 hover:bg-white/20"
              >
                Edit
              </button>
              <button
                type="button"
                aria-label={`Delete ${d.name}`}
                onClick={() => void deleteDeck(d.id)}
                className="rounded-lg bg-white/10 px-3 py-1 hover:bg-red-500/40"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Editor({ initial, onClose }: { initial: CustomDeck; onClose(): void }) {
  const collection = useProfile((s) => s.profile.collection);
  const saveDeck = useProfile((s) => s.saveDeck);
  const [name, setName] = useState(initial.name);
  const [counts, setCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(initial.cards.map((c) => [c.id, c.count])),
  );

  const cards = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([id, count]) => ({ id, count }));
  const list: DeckList = { name, cards };
  const total = cards.reduce((n, c) => n + c.count, 0);
  const problems = validateCustomDeck(list, registry, collection);
  const nameTotals = new Map<string, number>();
  for (const c of cards) {
    const def = registry.defs[c.id];
    if (def) nameTotals.set(def.name, (nameTotals.get(def.name) ?? 0) + c.count);
  }

  const available = useMemo(
    () =>
      [
        ...Object.keys(collection)
          .filter((id) => (collection[id] ?? 0) > 0)
          .map((id) => registry.defs[id])
          .filter((d): d is CardDef => d !== undefined && !isBasicEnergy(d))
          .sort(byCategoryThenId),
        ...BASIC_ENERGY,
      ].map((def) => ({ def, playable: isPlayable(def, registry) })),
    [collection],
  );

  const change = (id: string, delta: number) =>
    setCounts((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) + delta) }));
  const canAdd = (def: CardDef, playable: boolean): boolean => {
    if (isBasicEnergy(def)) return true;
    return (
      playable &&
      (counts[def.id] ?? 0) < (collection[def.id] ?? 0) &&
      (nameTotals.get(def.name) ?? 0) < MAX_COPIES
    );
  };
  const [saveError, setSaveError] = useState<string | null>(null);
  const save = async () => {
    try {
      await saveDeck({ id: initial.id, name: name.trim() || 'Untitled deck', cards });
      onClose();
    } catch (e) {
      setSaveError(`Couldn't save: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          <span className="text-sm text-white/70">Deck name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg bg-white/10 px-3 py-1.5"
          />
        </label>
        <span className={`font-semibold ${total === DECK_SIZE ? 'text-emerald-300' : 'text-amber-300'}`}>
          {total} / {DECK_SIZE}
        </span>
        <button
          type="button"
          disabled={problems.length > 0}
          onClick={() => void save()}
          className="ml-auto rounded-lg bg-amber-400 px-4 py-2 font-semibold text-slate-900 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Save deck
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-white/10 px-4 py-2 hover:bg-white/20"
        >
          Cancel
        </button>
      </div>
      {saveError && (
        <p role="alert" className="text-red-300">
          {saveError}
        </p>
      )}
      {problems.length > 0 && (
        <ul aria-label="Problems" className="list-inside list-disc text-sm text-amber-200">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <h3 className="font-semibold">Your cards</h3>
          <ul aria-label="Available cards" className="flex max-h-[60vh] flex-col gap-1 overflow-auto">
            {available.map(({ def, playable }) => (
              <li
                key={def.id}
                className={`flex items-center gap-2 rounded-lg bg-white/5 px-3 py-1 ${playable ? '' : 'opacity-50'}`}
              >
                <span className="flex-1">
                  {def.name} <span className="text-xs text-white/40">#{cardNumber(def.id)}</span>
                </span>
                {playable ? (
                  <span className="text-xs text-white/50">
                    {isBasicEnergy(def)
                      ? 'Free'
                      : `${counts[def.id] ?? 0} / ${collection[def.id] ?? 0} owned`}
                  </span>
                ) : (
                  <span className="text-xs text-white/50">Isn't playable yet</span>
                )}
                <button
                  type="button"
                  aria-label={`Add ${def.name}`}
                  disabled={!canAdd(def, playable)}
                  onClick={() => change(def.id, 1)}
                  className="rounded bg-white/10 px-2 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  +
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="font-semibold">Deck</h3>
          <ul aria-label="Deck" className="flex flex-col gap-1">
            {cards
              .map((c) => ({ ...c, def: registry.defs[c.id]! }))
              .sort((a, b) => byCategoryThenId(a.def, b.def))
              .map(({ id, count, def }) => (
                <li key={id} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-1">
                  <span className="w-8 font-semibold">{count}×</span>
                  <span className="flex-1">{def.name}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${def.name}`}
                    onClick={() => change(id, -1)}
                    className="rounded bg-white/10 px-2 hover:bg-white/20"
                  >
                    −
                  </button>
                </li>
              ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
