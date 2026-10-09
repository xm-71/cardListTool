import { useState } from 'react';
import { PACKS } from '@ptcg/economy';
import { ScreenFrame } from '../nav/ScreenFrame.tsx';
import { useProfile } from '../profile/useProfile.ts';
import { ERAS } from '../game/catalog.ts';
import { PackOpening } from '../ui/PackOpening.tsx';
import { PackArt } from '../ui/pack/PackArt.tsx';
import { EraFilter, matchesQuery } from '../ui/EraFilter.tsx';
import { Box, Button } from '../ui/retro/index.ts';

export function Shop() {
  return (
    <ScreenFrame>
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

  return (
    <section className="flex flex-col gap-5">
      <Box title="Shop">
        <p className="text-xl">
          {collector
            ? 'Collector mode: every pack is free. Rip as many as you like!'
            : 'Win games against the bots to earn credits, then spend them here.'}
        </p>
      </Box>
      <div role="group" aria-label="Filter packs" className="retro-box p-4">
        <EraFilter
          eras={[...new Set(PACKS.map((p) => p.era))]}
          era={era}
          onEra={setEra}
          query={query}
          onQuery={setQuery}
          searchLabel="Search packs"
        />
      </div>
      {shown.length === 0 && <p className="text-xl">No packs match.</p>}
      {ERAS.filter((e) => shown.some((p) => p.era === e.id)).map((eraGroup) => (
        <section key={eraGroup.id} aria-label={eraGroup.label} className="flex flex-col gap-4">
          <h2 className="font-pixel text-xs uppercase">{eraGroup.label}</h2>
          <div className="flex flex-wrap justify-center gap-6">
            {shown.filter((p) => p.era === eraGroup.id).map((p) => (
              <div
                key={p.setId}
                role="group"
                aria-label={p.name}
                className="retro-box flex w-60 flex-col items-center gap-3 p-5"
              >
                <PackArt setId={p.setId} name={p.name} className="-rotate-3" />
                <h3 className="mt-2 font-pixel text-[10px]">{p.name}</h3>
                <p className="text-2xl">{collector ? 'FREE' : `${p.price} credits`}</p>
                <Button
                  disabled={!ready || busy || (!collector && credits < p.price)}
                  onClick={() => void buy(p.setId)}
                >
                  Buy & open
                </Button>
              </div>
            ))}
          </div>
        </section>
      ))}
      {error && (
        <p role="alert" className="retro-box border-red p-3 text-xl text-red">
          {error}
        </p>
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
