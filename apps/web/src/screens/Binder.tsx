import { useMemo, useState } from 'react';
import type { CardInstance } from '@ptcg/engine';
import { SETS, setCards } from '@ptcg/cards';
import { isDeckUsable, isGymUsable } from '@ptcg/economy';
import { registry } from '../game/catalog.ts';
import { ScreenFrame } from '../nav/ScreenFrame.tsx';
import { useProfile } from '../profile/useProfile.ts';
import { CardDetails } from '../ui/CardDetails.tsx';
import { CardView } from '../ui/CardView.tsx';
import { ERAS } from '../game/catalog.ts';
import { BinderBook } from '../ui/binder/BinderBook.tsx';
import { BinderShelf } from '../ui/binder/BinderShelf.tsx';

export const cardNumber = (id: string): string => id.slice(id.lastIndexOf('-') + 1);

export function Binder() {
  const [tab, setTab] = useState<'all' | 'mine'>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const tabs = [
    { id: 'all', label: 'All cards' },
    { id: 'mine', label: 'My binders' },
  ] as const;
  return (
    <ScreenFrame wide>
      <div role="tablist" aria-label="Binder" className="mb-4 flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => {
              setTab(t.id);
              setOpenId(null);
            }}
            className={`border-4 border-ink px-3 py-2 font-pixel text-[10px] uppercase ${tab === t.id ? 'retro-shadow bg-yellow' : 'bg-paper hover:bg-cream'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'all' && <BinderBody />}
      {tab === 'mine' &&
        (openId ? (
          <BinderBook binderId={openId} onBack={() => setOpenId(null)} />
        ) : (
          <BinderShelf onOpen={setOpenId} />
        ))}
    </ScreenFrame>
  );
}

function BinderBody() {
  const collection = useProfile((s) => s.profile.collection);
  const [setId, setSetId] = useState(SETS[0]!.id);
  const era = SETS.find((s) => s.id === setId)?.era;
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [playableOnly, setPlayableOnly] = useState(false);
  const [details, setDetails] = useState<CardInstance | null>(null);
  const cards = useMemo(
    // Classic cards (even their Basic Energy) are collect-only until a Classic ruleset exists, and
    // Scarlet & Violet cards are playable only in the Gym format (Gym Challenge).
    () =>
      setCards(setId).map((def) => ({
        def,
        playable: era === 'mega' ? isDeckUsable(def, registry) : era === 'sv' && isGymUsable(def, registry),
      })),
    [setId, era],
  );
  const shown = cards.filter(
    ({ def, playable }) => (!ownedOnly || (collection[def.id] ?? 0) > 0) && (!playableOnly || playable),
  );
  const ownedCount = cards.filter(({ def }) => (collection[def.id] ?? 0) > 0).length;

  return (
    <section className="flex flex-col gap-4">
      <div role="group" aria-label="Sets" className="retro-box flex flex-col gap-3 p-4">
        {ERAS.map((era) => (
          <div key={era.id} className="flex flex-wrap items-center gap-2">
            <span className="w-full font-pixel text-[8px] uppercase opacity-70 sm:w-36">{era.label}</span>
            {SETS.filter((s) => s.era === era.id).map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={s.id === setId}
                onClick={() => setSetId(s.id)}
                className={`border-4 border-ink px-3 py-2 font-pixel text-[9px] uppercase ${s.id === setId ? 'retro-shadow bg-yellow' : 'bg-paper hover:bg-cream'}`}
              >
                {s.name}
              </button>
            ))}
          </div>
        ))}
      </div>
      <div className="retro-box flex flex-wrap items-center gap-3 p-4">
        <span className="text-xl">
          {ownedCount} / {cards.length} collected
        </span>
        <label className="ml-auto flex items-center gap-2 text-xl">
          <input type="checkbox" checked={ownedOnly} onChange={(e) => setOwnedOnly(e.target.checked)} /> Owned
          only
        </label>
        <label className="flex items-center gap-2 text-xl">
          <input type="checkbox" checked={playableOnly} onChange={(e) => setPlayableOnly(e.target.checked)} />{' '}
          Playable only
        </label>
      </div>
      <ul aria-label="Cards" className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-3">
        {shown.map(({ def, playable }) => {
          const count = collection[def.id] ?? 0;
          const classic = era === 'classic';
          const card = { uid: `binder-${def.id}`, defId: def.id, owner: 0 as const };
          return (
            <li
              key={def.id}
              aria-label={`${def.name} #${cardNumber(def.id)}`}
              data-owned={count > 0}
              className={`flex flex-col items-center gap-1 ${count > 0 ? '' : 'opacity-35 grayscale'}`}
            >
              <CardView card={card} size="md" noPreview onClick={() => setDetails(card)} />
              <div className="flex flex-wrap items-center justify-center gap-1 text-lg leading-none">
                <span className="opacity-60">#{cardNumber(def.id)}</span>
                {count > 0 ? (
                  <span className="font-semibold">×{count}</span>
                ) : (
                  <span className="sr-only">Not owned</span>
                )}
                {classic && (
                  <span className="border-2 border-ink bg-paper px-1 font-pixel text-[7px]">Classic</span>
                )}
                {playable && (
                  <span className="border-2 border-ink bg-green px-1 font-pixel text-[7px] text-paper">
                    Playable
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {shown.length === 0 && <p className="text-xl">No cards match these filters yet.</p>}
      {details && <CardDetails card={details} onClose={() => setDetails(null)} />}
    </section>
  );
}
