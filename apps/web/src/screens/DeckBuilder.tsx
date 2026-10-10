import { useMemo, useState } from 'react';
import type { CardDef, DeckList } from '@ptcg/engine';
import { SETS, isCollectOnlyEra } from '@ptcg/cards';
import { DECK_SIZE, deckFormat, isGymUsable, MAX_COPIES, validateGymDeck } from '@ptcg/economy';
import { eraLabel, registry } from '../game/catalog.ts';
import { ScreenFrame } from '../nav/ScreenFrame.tsx';
import { useProfile } from '../profile/useProfile.ts';
import type { CustomDeck } from '../profile/types.ts';
import { cardNumber } from './Binder.tsx';
import { CardThumb } from '../ui/CardThumb.tsx';

const isBasicEnergy = (def: CardDef): boolean => def.category === 'Energy' && def.energyKind === 'Basic';
// One of each type, from the modern Mega Evolution Energy set.
const BASIC_ENERGY = Object.values(registry.defs)
  .filter((d) => isBasicEnergy(d) && d.id.startsWith('mee-'))
  .sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
const SET_ERA = new Map(SETS.map((s) => [s.id, s.era]));
/** The collect-only era a card belongs to (null for cards from the playable eras). */
const vintageEra = (id: string) => {
  const era = SET_ERA.get(id.slice(0, id.lastIndexOf('-')));
  return era !== undefined && isCollectOnlyEra(era) ? era : null;
};
const isClassic = (id: string): boolean => vintageEra(id) !== null;
const CATEGORY_ORDER = { Pokemon: 0, Trainer: 1, Energy: 2 } as const;
const byCategoryThenId = (a: CardDef, b: CardDef): number =>
  CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category] ||
  a.id.localeCompare(b.id, 'en', { numeric: true });

const newId = (): string => `deck-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function DeckBuilder() {
  return (
    <ScreenFrame wide>
      <DeckBuilderBody />
    </ScreenFrame>
  );
}

function DeckBuilderBody() {
  const decks = useProfile((s) => s.profile.decks);
  const deleteDeck = useProfile((s) => s.deleteDeck);
  const [editing, setEditing] = useState<CustomDeck | null>(null);

  if (editing) return <Editor initial={editing} onClose={() => setEditing(null)} />;
  return (
    <section className="flex flex-col gap-4">
      <div className="retro-box flex items-center gap-3 p-4">
        <h2 className="font-pixel text-xs uppercase">Your decks</h2>
        <button
          type="button"
          onClick={() => setEditing({ id: newId(), name: 'New deck', cards: [] })}
          className="retro-shadow ml-auto border-4 border-ink bg-yellow px-3 py-2 font-pixel text-[10px] uppercase"
        >
          New deck
        </button>
      </div>
      <p className="text-xl">
        Build decks from cards you own that the game can play. Basic Energy is free. Starter decks are always
        available on the Home screen.
      </p>
      {decks.length === 0 ? (
        <p className="text-xl">No custom decks yet.</p>
      ) : (
        <ul aria-label="Saved decks" className="flex flex-col gap-2">
          {decks.map((d) => (
            <li key={d.id} className="retro-box flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="font-pixel text-[10px]">{d.name}</span>
              <span className="text-xl opacity-70">{d.cards.reduce((n, c) => n + c.count, 0)} cards</span>
              <FormatBadge format={deckFormat(d, registry)} />
              <button
                type="button"
                aria-label={`Edit ${d.name}`}
                onClick={() => setEditing(d)}
                className="ml-auto border-4 border-ink bg-paper px-2 py-1 font-pixel text-[9px] uppercase hover:bg-cream"
              >
                Edit
              </button>
              <button
                type="button"
                aria-label={`Delete ${d.name}`}
                onClick={() => void deleteDeck(d.id)}
                className="border-4 border-ink bg-paper px-2 py-1 font-pixel text-[9px] uppercase hover:bg-red hover:text-paper"
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

/** "Standard" decks work in Duel and Gym Challenge; "Gym" decks (with 151 cards) only in Gym Challenge. */
function FormatBadge({ format }: { format: 'standard' | 'gym' }) {
  return (
    <span
      title={format === 'standard' ? 'Legal in Duel and Gym Challenge' : 'Has 151 cards: Gym Challenge only'}
      className={`border-2 border-ink px-2 py-1 font-pixel text-[8px] uppercase ${format === 'standard' ? 'bg-paper' : 'bg-purple text-paper'}`}
    >
      {format === 'standard' ? 'Standard' : 'Gym only'}
    </span>
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
  const problems = validateGymDeck(list, registry, collection);
  const format = deckFormat(list, registry);
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
          // Usable cards first; classic (collect-only) cards after them.
          .sort((a, b) => Number(isClassic(a.id)) - Number(isClassic(b.id)) || byCategoryThenId(a, b)),
        ...BASIC_ENERGY,
      ].map((def) => ({ def, playable: isGymUsable(def, registry) })),
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
      <div className="retro-box flex flex-wrap items-center gap-3 p-4">
        <label className="flex items-center gap-2">
          <span className="font-pixel text-[9px] uppercase">Deck name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border-b-4 border-ink bg-transparent px-1 text-2xl outline-none"
          />
        </label>
        <span className={`font-pixel text-xs ${total === DECK_SIZE ? 'text-green' : 'text-red'}`}>
          {total} / {DECK_SIZE}
        </span>
        <FormatBadge format={format} />
        <button
          type="button"
          disabled={problems.length > 0}
          onClick={() => void save()}
          className="retro-shadow ml-auto border-4 border-ink bg-yellow px-3 py-2 font-pixel text-[10px] uppercase disabled:cursor-not-allowed disabled:opacity-40"
        >
          Save deck
        </button>
        <button
          type="button"
          onClick={onClose}
          className="border-4 border-ink bg-paper px-3 py-2 font-pixel text-[10px] uppercase hover:bg-cream"
        >
          Cancel
        </button>
      </div>
      {saveError && (
        <p role="alert" className="text-xl text-red">
          {saveError}
        </p>
      )}
      {problems.length > 0 && (
        <ul aria-label="Problems" className="retro-box list-inside list-disc p-4 text-xl text-red">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="retro-box flex flex-col gap-2 p-4">
          <h3 className="font-pixel text-[10px] uppercase">Your cards</h3>
          <ul aria-label="Available cards" className="flex max-h-[60vh] flex-col gap-1 overflow-auto">
            {available.map(({ def, playable }) => (
              <li
                key={def.id}
                className={`flex items-center gap-2 border-b-2 border-ink/20 px-1 py-1 text-xl ${playable ? '' : 'opacity-50'}`}
              >
                <CardThumb def={def} />
                <span className="flex-1">
                  {def.name} <span className="opacity-50">#{cardNumber(def.id)}</span>
                </span>
                {playable ? (
                  <span className="text-lg opacity-70">
                    {isBasicEnergy(def)
                      ? 'Free'
                      : `${counts[def.id] ?? 0} / ${collection[def.id] ?? 0} owned`}
                  </span>
                ) : (
                  <span className="text-lg opacity-70">
                    {vintageEra(def.id)
                      ? `${eraLabel(vintageEra(def.id)!)}: not playable yet`
                      : "Isn't playable yet"}
                  </span>
                )}
                <button
                  type="button"
                  aria-label={`Add ${def.name}`}
                  disabled={!canAdd(def, playable)}
                  onClick={() => change(def.id, 1)}
                  className="border-2 border-ink bg-yellow px-2 font-pixel text-xs disabled:cursor-not-allowed disabled:bg-paper disabled:opacity-30"
                >
                  +
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="retro-box flex flex-col gap-2 p-4">
          <h3 className="font-pixel text-[10px] uppercase">Deck</h3>
          <ul aria-label="Deck" className="flex flex-col gap-1">
            {cards
              .map((c) => ({ ...c, def: registry.defs[c.id]! }))
              .sort((a, b) => byCategoryThenId(a.def, b.def))
              .map(({ id, count, def }) => (
                <li key={id} className="flex items-center gap-2 border-b-2 border-ink/20 px-1 py-1 text-xl">
                  <span className="w-10">{count}×</span>
                  <CardThumb def={def} />
                  <span className="flex-1">{def.name}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${def.name}`}
                    onClick={() => change(id, -1)}
                    className="border-2 border-ink bg-paper px-2 font-pixel text-xs hover:bg-cream"
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
