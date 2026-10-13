import { useEffect, useRef, useState } from 'react';
import { deckPrice } from '@ptcg/economy';
import { DECKS, registry, type DeckInfo } from '../../game/catalog.ts';
import { useProfile } from '../../profile/useProfile.ts';
import { RunDeckView } from '../frontier/RunDeckView.tsx';
import { Sheet } from '../Sheet.tsx';

const GROUPS = [
  { kind: 'starter', title: 'Starter decks' },
  { kind: 'theme', title: 'Theme decks' },
  { kind: 'meta', title: 'Meta decks' },
] as const;

const credits = (n: number) => `${n.toLocaleString('en-US')} credits`;

/** The Poké Mart's Decks tab: every premade deck with its price (or OWNED), and a sheet with its cards and Buy. */
export function DeckShop() {
  const balance = useProfile((s) => s.profile.credits);
  const owned = useProfile((s) => s.profile.ownedDecks);
  const ready = useProfile((s) => s.ready);
  const buyDeck = useProfile((s) => s.buyDeck);
  const [openId, setOpenId] = useState<string | null>(null);
  const [bought, setBought] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A ref, not state: two presses in the same tick must not both start a purchase.
  const busy = useRef(false);
  const confirmation = useRef<HTMLParagraphElement>(null);
  // The Buy button is gone once the deck is bought: keep focus in the sheet, on the confirmation.
  useEffect(() => {
    if (bought) confirmation.current?.focus();
  }, [bought]);
  const open = DECKS.find((d) => d.id === openId);

  const buy = async (deck: DeckInfo) => {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    try {
      await buyDeck(deck.id);
      setBought(deck.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      busy.current = false;
    }
  };

  return (
    <section className="flex flex-col gap-4">
      <p className="text-xl">
        Buy a deck to play it and add its 60 cards to your binder. Your starter deck is already yours.
      </p>
      {GROUPS.map(({ kind, title }) => (
        <section key={kind} aria-label={title} className="flex flex-col gap-2">
          <h2 className="font-pixel text-[10px] uppercase">
            {title} · {credits(deckPrice(kind))} each
          </h2>
          <div className="flex flex-wrap gap-3">
            {DECKS.filter((d) => d.kind === kind).map((d) => {
              const isOwned = owned.includes(d.id);
              return (
                <button
                  key={d.id}
                  type="button"
                  aria-label={`View ${d.name}`}
                  onClick={() => {
                    setError(null);
                    setBought(null);
                    setOpenId(d.id);
                  }}
                  className="retro-box flex w-32 flex-col items-center gap-2 p-2 hover:bg-cream"
                >
                  <img src={`${registry.defs[d.cover]!.image}/low.webp`} alt="" className="w-20" />
                  <span className="font-pixel text-[8px] leading-relaxed">{d.name}</span>
                  <span className="text-lg leading-none">{d.type}</span>
                  <span
                    className={`font-pixel text-[8px] ${isOwned ? 'border-2 border-ink-fixed bg-green px-1 py-0.5 text-ink-fixed' : ''}`}
                  >
                    {isOwned ? 'OWNED' : credits(deckPrice(d.kind))}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
      {open && (
        <Sheet title={open.name} onClose={() => setOpenId(null)} className="max-h-[85dvh]">
          <RunDeckView cards={open.list.cards} label="Deck list" />
          {bought === open.id && (
            <p ref={confirmation} role="status" tabIndex={-1} className="text-xl outline-none">
              Added to your decks. 60 cards added to your binder.
            </p>
          )}
          {error && (
            <p role="alert" className="text-xl text-red-fg">
              {error}
            </p>
          )}
          {!owned.includes(open.id) && (
            <BuyButton deck={open} balance={balance} ready={ready} onBuy={() => void buy(open)} />
          )}
        </Sheet>
      )}
    </section>
  );
}

function BuyButton({
  deck,
  balance,
  ready,
  onBuy,
}: {
  deck: DeckInfo;
  balance: number;
  ready: boolean;
  onBuy(): void;
}) {
  const price = deckPrice(deck.kind);
  const affordable = balance >= price;
  return (
    <button
      type="button"
      disabled={!ready || !affordable}
      onClick={onBuy}
      className="retro-shadow self-start border-4 border-ink-fixed bg-yellow px-4 py-2 font-pixel text-[10px] uppercase text-ink-fixed disabled:opacity-50"
    >
      {affordable ? `Buy for ${credits(price)}` : 'Not enough credits'}
    </button>
  );
}
