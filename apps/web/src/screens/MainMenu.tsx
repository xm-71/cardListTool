import { useState } from 'react';
import { deckById, registry, type DeckId } from '../game/catalog.ts';
import { useNav, type Route } from '../nav/useNav.ts';
import { useProfile } from '../profile/useProfile.ts';
import { DialogBox, Header, Menu } from '../ui/retro/index.ts';

const ITEMS: { id: Route; label: string }[] = [
  { id: 'duel', label: 'Duel' },
  { id: 'shop', label: 'Shop' },
  { id: 'binder', label: 'Binder' },
  { id: 'decks', label: 'Decks' },
  { id: 'options', label: 'Options' },
];

/** Collector mode hides battling. */
export const COLLECTOR_ITEMS = ITEMS.filter(
  (i) => i.id === 'shop' || i.id === 'binder' || i.id === 'options',
);

export const COLLECTOR_TIPS = [
  'Packs are free in Collector mode — rip away!',
  'Fill a binder page with your favourite pulls.',
  'Decorate binder covers with stickers.',
];

const TIPS = [
  'Battle the bots to earn credits!',
  'Medium bots pay more credits than Easy ones.',
  'Cards with a PLAYABLE badge can go in your decks.',
  'Basic Energy is free in the deck builder.',
  'A Mega Hyper Rare is the rarest pull in a pack!',
];

export function MainMenu() {
  const starter = useProfile((s) => s.profile.starterDeck);
  const go = useNav((s) => s.go);
  const collector = useProfile((s) => s.profile.collectorMode);
  const tips = collector ? COLLECTOR_TIPS : TIPS;
  const [roll] = useState(() => Math.random());
  const tip = tips[Math.floor(roll * tips.length)]!;
  const deck = deckById((starter ?? 'mega-gengar') as DeckId) ?? deckById('mega-gengar');
  return (
    <div className="flex min-h-full flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 p-4">
        <div className="flex flex-wrap items-center justify-center gap-8">
          <div className="retro-box w-64 px-6 py-4">
            <Menu
              label="Main menu"
              items={collector ? COLLECTOR_ITEMS : ITEMS}
              onSelect={(id) => go(id as Route)}
              autoFocus
            />
          </div>
          <figure className="flex flex-col items-center gap-3">
            <img
              src={`${registry.defs[deck.cover]!.image}/low.webp`}
              alt={deck.name}
              className="retro-shadow w-36 rounded-md border-4 border-ink"
            />
            <figcaption className="font-pixel text-[9px] leading-relaxed">
              YOUR DECK:
              <br />
              {deck.name}
            </figcaption>
          </figure>
        </div>
        <DialogBox text={tip} />
      </main>
    </div>
  );
}
