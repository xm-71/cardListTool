import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { sfx } from '../audio/sfx.ts';
import { BUILDINGS, describeBuilding, moveInTown, townStatus, type BuildingId } from '../game/town.ts';
import { useNav, type Route } from '../nav/useNav.ts';
import { useProfile } from '../profile/useProfile.ts';
import { useSettings } from '../settings/useSettings.ts';
import { Header } from '../ui/retro/index.ts';
import { TownBuilding } from '../ui/town/TownBuilding.tsx';
import { TrainerCard } from '../ui/town/TrainerCard.tsx';

const COLLECTOR_TIPS = [
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

/**
 * The main menu: a town square. Arrow keys walk between buildings, Enter or a click goes in; on a touch screen the
 * first tap selects (and the dialog box describes the building), the second goes in. Collector mode closes the
 * battling buildings.
 */
export function MainMenu() {
  const go = useNav((s) => s.go);
  const profile = useProfile((s) => s.profile);
  const motion = useSettings((s) => s.animations) !== 'off';
  const collector = profile.collectorMode;
  const tips = collector ? COLLECTOR_TIPS : TIPS;
  const [roll] = useState(() => Math.random());
  const tip = tips[Math.floor(roll * tips.length)]!;
  const open = (id: BuildingId) => !(collector && BUILDINGS.find((b) => b.id === id)!.battle);
  const [active, setActive] = useState<BuildingId>(collector ? 'shop' : 'duel');
  const current = open(active) ? active : 'shop';
  const [card, setCard] = useState(false);
  /** The last press was a finger or a pen: a tap on another building previews it before going in. */
  const touch = useRef(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const status = townStatus(profile);

  const select = (id: BuildingId) => {
    if (id !== current) sfx('cursor');
    setActive(id);
  };
  const enter = (id: BuildingId) => {
    sfx('confirm');
    const route = BUILDINGS.find((b) => b.id === id)!.route;
    if (route) go(route);
    else setCard(true);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (card) return;
    if (e.key.startsWith('Arrow')) select(moveInTown(current, e.key, open));
    else if (e.key === 'Enter' || e.key === ' ') enter(current);
    else return;
    e.preventDefault();
  };
  const onClick = (id: BuildingId) => {
    // A tap on a building that isn't selected yet only selects it, so its description can be read first.
    if (touch.current && id !== current) select(id);
    else enter(id);
    touch.current = false;
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-4 p-4">
        <div className="overflow-hidden border-4 border-ink retro-shadow">
          <div
            ref={ref}
            role="menu"
            aria-label="Main menu"
            tabIndex={0}
            onKeyDown={onKeyDown}
            data-motion={motion ? 'on' : 'off'}
            className="town play-mat outline-none focus-visible:outline-4 focus-visible:outline-offset-[-8px] focus-visible:outline-ink"
          >
            {BUILDINGS.map((b) => (
              <TownBuilding
                key={b.id}
                building={b}
                status={status}
                active={b.id === current}
                closed={!open(b.id)}
                onPointerEnter={(e) => e.pointerType === 'mouse' && select(b.id)}
                onPointerDown={(e) => {
                  touch.current = e.pointerType !== 'mouse';
                }}
                onClick={() => onClick(b.id)}
              />
            ))}
            <div className="town-centre" aria-hidden>
              <span className="town-trainer" />
              <span className="town-fountain" />
            </div>
          </div>
          <p aria-live="polite" data-testid="town-dialog" className="min-h-20 border-t-4 border-ink bg-paper px-5 py-3 text-2xl leading-snug">
            <span className="mb-1 block font-pixel text-[10px] uppercase">
              {BUILDINGS.find((b) => b.id === current)!.sign}
            </span>
            {describeBuilding(current, profile, tip)}
          </p>
        </div>
      </main>
      {card && (
        <TrainerCard
          onClose={() => setCard(false)}
          onGo={(route: Route) => {
            setCard(false);
            go(route);
          }}
        />
      )}
    </div>
  );
}
