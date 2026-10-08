import { useEffect } from 'react';
import { sfx, unlockAudio } from '../audio/sfx.ts';
import { useNav } from '../nav/useNav.ts';
import { useProfile } from '../profile/useProfile.ts';
import { useSettings } from '../settings/useSettings.ts';
import { PokeBall } from '../ui/PokeBall.tsx';

const START_KEYS = /^(Enter| |[a-z0-9])$/i;

export function Title() {
  const ready = useProfile((s) => s.ready);
  const introDone = useProfile((s) => s.profile.introDone);
  const skipTitle = useSettings((s) => s.skipTitle);

  // Returning players can opt to skip this screen (never the intro).
  useEffect(() => {
    if (ready && introDone && skipTitle) useNav.getState().go('menu');
  }, [ready, introDone, skipTitle]);

  useEffect(() => {
    if (!ready) return;
    const start = () => {
      unlockAudio();
      sfx('confirm');
      useNav.getState().go(introDone ? 'menu' : 'intro');
    };
    const onKey = (e: KeyboardEvent) => {
      if (!START_KEYS.test(e.key)) return;
      // Keep this key from also reaching the next screen (e.g. submitting or typing into the name field).
      e.preventDefault();
      start();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('click', start);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('click', start);
    };
  }, [ready, introDone]);

  return (
    <main className="flex min-h-full cursor-pointer flex-col items-center justify-center gap-8 p-6 text-center">
      <h1 aria-label="Pokémon Trading Card Game" className="flex flex-col items-center gap-4 font-pixel">
        <span
          className="text-4xl text-yellow sm:text-6xl"
          style={{
            textShadow:
              '4px 0 var(--color-ink), -4px 0 var(--color-ink), 0 4px var(--color-ink), 0 -4px var(--color-ink), 4px 4px var(--color-ink), 6px 8px var(--color-blue)',
          }}
        >
          POKéMON
        </span>
        <span className="text-xs tracking-widest text-red sm:text-sm">TRADING CARD GAME</span>
      </h1>
      <PokeBall size={72} />
      <p className="animate-blink font-pixel text-sm">{ready ? 'PRESS START' : 'LOADING…'}</p>
      <p className="max-w-md text-base opacity-60">
        Private fan project for friends. Pokémon and all card names, text and images are © Nintendo,
        Creatures, GAME FREAK and The Pokémon Company. Not affiliated with or endorsed by them.
      </p>
    </main>
  );
}
