import { useMemo, useState } from 'react';
import { PACKS, PACK_PRICES, type PackDef } from '@ptcg/economy';
import { ScreenFrame } from '../nav/ScreenFrame.tsx';
import { useProfile } from '../profile/useProfile.ts';
import { ERAS } from '../game/catalog.ts';
import { PackOpening } from '../ui/PackOpening.tsx';
import { EraFilter, matchesQuery } from '../ui/EraFilter.tsx';
import { setProgress } from '../game/collection.ts';
import { Sheet } from '../ui/Sheet.tsx';
import { useIsPhone } from '../ui/useIsPhone.ts';
import { EraList } from '../ui/shop/EraList.tsx';
import { PackDetail, type PackBuy } from '../ui/shop/PackDetail.tsx';
import { PackRow } from '../ui/shop/PackRow.tsx';
import { PackTile } from '../ui/shop/PackTile.tsx';

export function Shop() {
  return (
    <ScreenFrame wide>
      <ShopBody />
    </ScreenFrame>
  );
}

function ShopBody() {
  const credits = useProfile((s) => s.profile.credits);
  const buyPack = useProfile((s) => s.buyPack);
  const ready = useProfile((s) => s.ready);
  const collector = useProfile((s) => s.profile.collectorMode);
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState<{ setId: string; cards: string[]; n: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [era, setEra] = useState<(typeof ERAS)[number]['id'] | 'all'>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const phone = useIsPhone();
  const collection = useProfile((s) => s.profile.collection);
  const progress = useMemo(
    () => new Map(PACKS.map((p) => [p.setId, setProgress(collection, p.setId)])),
    [collection],
  );
  const shown = PACKS.filter((p) => (era === 'all' || p.era === era) && matchesQuery(p.name, query));

  const buy = async (setId: string) => {
    setBusy(true);
    setError(null);
    try {
      const cards = await buyPack(setId);
      setOpened((prev) => ({ setId, cards, n: (prev?.n ?? 0) + 1 }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  /** "Open another" for the pack just opened: always in Collector mode, otherwise when the player can afford it. */
  const againFor = (setId: string) => {
    const pack = PACKS.find((p) => p.setId === setId);
    if (!pack) return undefined;
    return {
      label: collector ? `Open another ${pack.name}` : `Open another ${pack.name} (${pack.price} credits)`,
      disabled: !ready || busy || (!collector && credits < pack.price),
      onClick: () => void buy(setId),
    };
  };

  const selected = shown.find((p) => p.setId === selectedId) ?? shown[0];
  const buyFor = (p: PackDef): PackBuy => ({
    price: collector ? 'FREE' : `${p.price} credits`,
    disabled: !ready || busy || (!collector && credits < p.price),
    onBuy: () => {
      setSheetId(null);
      void buy(p.setId);
    },
  });
  const eras = ERAS.filter((e) => shown.some((p) => p.era === e.id));
  const counts = Object.fromEntries(
    ERAS.map((e) => [e.id, PACKS.filter((p) => p.era === e.id).length]),
  ) as Partial<Record<(typeof ERAS)[number]['id'], number>>;
  const sheetPack = PACKS.find((p) => p.setId === sheetId);

  const sections = (
    <div className="flex min-w-0 flex-col gap-4">
      {shown.length === 0 && <p className="text-xl">No packs match.</p>}
      {eras.map((e) => {
        const packs = shown.filter((p) => p.era === e.id);
        return (
          <section key={e.id} aria-label={e.label} className="flex flex-col gap-2">
            <h2 className="font-pixel text-[10px] uppercase">
              {e.label} · {packs.length} {packs.length === 1 ? 'pack' : 'packs'} ·{' '}
              {collector ? 'free' : `${PACK_PRICES[e.id]}¢ each`}
            </h2>
            {phone ? (
              <div className="flex flex-col">
                {packs.map((p) => (
                  <PackRow
                    key={p.setId}
                    pack={p}
                    progress={progress.get(p.setId)!}
                    buy={buyFor(p)}
                    onDetails={() => setSheetId(p.setId)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {packs.map((p) => (
                  <PackTile
                    key={p.setId}
                    pack={p}
                    progress={progress.get(p.setId)!}
                    buy={buyFor(p)}
                    selected={p.setId === selected?.setId}
                    onSelect={() => setSelectedId(p.setId)}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );

  return (
    <section className="flex flex-col gap-4">
      {collector && <p className="text-xl">Collector mode: every pack is free. Rip as many as you like!</p>}
      {phone ? (
        <>
          <div role="group" aria-label="Filter packs" className="retro-box p-3">
            <EraFilter
              eras={[...new Set(PACKS.map((p) => p.era))]}
              era={era}
              onEra={setEra}
              query={query}
              onQuery={setQuery}
              searchLabel="Search packs"
            />
          </div>
          {sections}
        </>
      ) : (
        <div className="grid grid-cols-[14rem_minmax(0,1fr)_18rem] items-start gap-4">
          <div role="group" aria-label="Filter packs" className="retro-box sticky top-2 p-3">
            <EraList
              counts={counts}
              total={PACKS.length}
              era={era}
              onEra={setEra}
              query={query}
              onQuery={setQuery}
            />
          </div>
          {sections}
          <aside aria-label="Pack details" className="retro-box sticky top-2 p-3">
            {selected ? (
              <PackDetail pack={selected} progress={progress.get(selected.setId)!} buy={buyFor(selected)} />
            ) : (
              <p className="text-xl">Pick a pack to see what is inside.</p>
            )}
          </aside>
        </div>
      )}
      {error && (
        <p role="alert" className="retro-box border-red p-3 text-xl text-red">
          {error}
        </p>
      )}
      {phone && sheetPack && (
        <Sheet title={sheetPack.name} onClose={() => setSheetId(null)}>
          <PackDetail pack={sheetPack} progress={progress.get(sheetPack.setId)!} buy={buyFor(sheetPack)} />
        </Sheet>
      )}
      {opened && (
        <PackOpening
          key={opened.n}
          setId={opened.setId}
          cards={opened.cards}
          onDone={() => setOpened(null)}
          again={againFor(opened.setId)}
        />
      )}
    </section>
  );
}
