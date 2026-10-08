import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { sfx } from '../audio/sfx.ts';
import { registry } from '../game/catalog.ts';
import { CardView } from './CardView.tsx';
import { PackArt } from './pack/PackArt.tsx';
import { rarityTier, TAG } from './pack/rarity.ts';
import { Button } from './retro/index.ts';

export const SHAKE_MS = 600;
export const TEAR_MS = 400;
const FLASH_MS = 300;

type Phase = 'shake' | 'tear' | 'stack' | 'all';

const instance = (defId: string, i: number) => ({ uid: `pack-${i}`, defId, owner: 0 as const });

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Shake → tear → flip one card at a time (effects scale with rarity) → all. The cards are already saved. */
export function PackOpening({ setId, cards, onDone }: { setId: string; cards: string[]; onDone(): void }) {
  const [reduced] = useState(prefersReducedMotion);
  const [phase, setPhase] = useState<Phase>(reduced ? 'stack' : 'shake');
  const [shown, setShown] = useState(0);
  const [flash, setFlash] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const dialog = useRef<HTMLDivElement>(null);
  const later = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));

  useEffect(() => {
    // Focus the dialog so Enter/Space flip cards (and can't re-press the Buy button underneath).
    dialog.current?.focus();
    if (!reduced) {
      sfx('shake');
      later(SHAKE_MS, () => {
        sfx('tear');
        setPhase('tear');
        later(TEAR_MS, () => setPhase('stack'));
      });
    }
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
    // Runs once per opening.
  }, []);

  const flip = () => {
    if (phase !== 'stack' || shown >= cards.length) return;
    const def = registry.defs[cards[shown]!];
    const tier = rarityTier(def?.rarity ?? '');
    sfx('flip');
    if (tier !== 'common') sfx(tier);
    if (tier === 'special' && !reduced) {
      setFlash(true);
      later(FLASH_MS, () => setFlash(false));
    }
    setShown(shown + 1);
  };
  const revealAll = () => {
    sfx('rare');
    setFlash(false);
    setPhase('all');
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      flip();
    }
  };

  const current = shown > 0 ? cards[shown - 1]! : null;
  const currentDef = current ? registry.defs[current] : undefined;
  const tier = rarityTier(currentDef?.rarity ?? '');
  const tag = currentDef ? TAG[tier](currentDef.rarity) : null;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/80 p-4">
      {flash && (
        <div data-testid="flash" className="animate-flash pointer-events-none fixed inset-0 z-40 bg-white" />
      )}
      <div
        ref={dialog}
        role="dialog"
        aria-label="Pack opening"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="retro-box flex max-h-full w-full max-w-4xl flex-col items-center gap-5 overflow-auto p-6 outline-none"
      >
        {(phase === 'shake' || phase === 'tear') && (
          <div className="flex h-80 items-center justify-center">
            <PackArt
              setId={setId}
              name={setId === 'me02' ? 'Phantasmal Flames' : 'Mega Evolution'}
              torn={phase === 'tear'}
              className={phase === 'shake' ? 'animate-pack-shake' : 'animate-pack-tear'}
            />
          </div>
        )}
        {phase === 'stack' && (
          <>
            <p className="font-pixel text-[10px]">
              Card {shown} of {cards.length}
            </p>
            <div className="flex min-h-96 flex-wrap items-center justify-center gap-8">
              {shown < cards.length && (
                <button
                  type="button"
                  aria-label="Flip the next card"
                  onClick={flip}
                  className="card-back retro-shadow relative h-56 w-40 border-4 border-ink"
                >
                  <span className="absolute right-2 bottom-2 font-pixel text-[9px] text-paper">
                    ×{cards.length - shown}
                  </span>
                </button>
              )}
              {current && (
                <div
                  key={shown}
                  className={`relative flex flex-col items-center gap-3 animate-card-flip tier-${tier}`}
                >
                  <div className="relative">
                    <CardView card={instance(current, shown - 1)} size="lg" noPreview />
                    {tier === 'rare' && (
                      <div aria-hidden className="shine pointer-events-none absolute inset-0" />
                    )}
                    {tier === 'special' && (
                      <div aria-hidden className="foil pointer-events-none absolute inset-0" />
                    )}
                    {(tier === 'ultra' || tier === 'special') && <Sparkles />}
                  </div>
                  {tag && (
                    <span className="animate-tag-pop border-4 border-ink bg-purple px-2 py-1 font-pixel text-[9px] text-paper">
                      {tag}
                    </span>
                  )}
                </div>
              )}
            </div>
          </>
        )}
        {phase === 'all' && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {cards.map((id, i) => {
              const def = registry.defs[id];
              const t = rarityTier(def?.rarity ?? '');
              return (
                <div key={i} className="flex flex-col items-center gap-1">
                  <CardView card={instance(id, i)} size="md" noPreview />
                  {t !== 'common' && (
                    <span className="font-pixel text-[7px] text-purple">★ {def?.rarity}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className="flex gap-3">
          {phase === 'stack' && shown < cards.length && (
            <Button aria-label="Next" onClick={flip}>
              ▶ Next
            </Button>
          )}
          {phase === 'stack' && (
            <Button variant="plain" onClick={revealAll}>
              Reveal all
            </Button>
          )}
          {phase === 'all' && <Button onClick={onDone}>Done</Button>}
        </div>
      </div>
    </div>
  );
}

const SPARKS = [
  [-6, 8],
  [96, 4],
  [104, 60],
  [92, 96],
  [-4, 90],
  [40, -4],
];

function Sparkles() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {SPARKS.map(([x, y], i) => (
        <span
          key={i}
          className="animate-sparkle absolute size-3 border-2 border-ink bg-yellow"
          style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  );
}
