import { useState } from 'react';
import { PACKS } from '@ptcg/economy';
import { ScreenFrame } from '../nav/ScreenFrame.tsx';
import { useProfile } from '../profile/useProfile.ts';
import { PackOpening } from '../ui/PackOpening.tsx';
import { PackArt } from '../ui/pack/PackArt.tsx';
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
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const buy = async (setId: string) => {
    setBusy(true);
    setError(null);
    try {
      setOpened(await buyPack(setId));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="flex flex-col gap-5">
      <Box title="Shop">
        <p className="text-xl">Win games against the bots to earn credits, then spend them here.</p>
      </Box>
      <div className="flex flex-wrap justify-center gap-6">
        {PACKS.map((p) => (
          <div
            key={p.setId}
            role="group"
            aria-label={p.name}
            className="retro-box flex w-60 flex-col items-center gap-3 p-5"
          >
            <PackArt setId={p.setId} name={p.name} className="-rotate-3" />
            <h3 className="mt-2 font-pixel text-[10px]">{p.name}</h3>
            <p className="text-2xl">{p.price} credits</p>
            <Button disabled={!ready || busy || credits < p.price} onClick={() => void buy(p.setId)}>
              Buy & open
            </Button>
          </div>
        ))}
      </div>
      {error && (
        <p role="alert" className="retro-box border-red p-3 text-xl text-red">
          {error}
        </p>
      )}
      {opened && <PackOpening cards={opened} onDone={() => setOpened(null)} />}
    </section>
  );
}
