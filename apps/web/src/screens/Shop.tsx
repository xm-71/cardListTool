import { useState } from 'react';
import { SETS } from '@ptcg/cards';
import { PACKS } from '@ptcg/economy';
import { useProfile } from '../profile/useProfile.ts';
import { PackOpening } from '../ui/PackOpening.tsx';

export function Shop() {
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
    <section className="flex flex-col items-center gap-6">
      <h2 className="text-2xl font-bold">Shop</h2>
      <p className="text-sm text-white/60">Win games against the bots to earn credits.</p>
      <div className="flex flex-wrap justify-center gap-6">
        {PACKS.map((p) => {
          const logo = SETS.find((s) => s.id === p.setId)?.logo;
          return (
            <div
              key={p.setId}
              role="group"
              aria-label={p.name}
              className="flex w-56 flex-col items-center gap-3 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10"
            >
              {logo ? <img src={`${logo}.webp`} alt="" className="h-20 object-contain" /> : null}
              <h3 className="font-semibold">{p.name}</h3>
              <p className="text-sm text-white/60">10 cards</p>
              <p className="font-semibold text-amber-300">{p.price} credits</p>
              <button
                type="button"
                disabled={!ready || busy || credits < p.price}
                onClick={() => void buy(p.setId)}
                className="rounded-lg bg-amber-400 px-5 py-2 font-semibold text-slate-900 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Buy & open
              </button>
            </div>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="text-red-300">
          {error}
        </p>
      )}
      {opened && <PackOpening cards={opened} onDone={() => setOpened(null)} />}
    </section>
  );
}
