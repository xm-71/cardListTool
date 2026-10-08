import { useState } from 'react';
import { sfx } from '../audio/sfx.ts';
import { STARTER_DECKS, registry } from '../game/catalog.ts';
import { useNav } from '../nav/useNav.ts';
import { MAX_NAME, useProfile } from '../profile/useProfile.ts';
import { Box, Button, DialogBox } from '../ui/retro/index.ts';

export const INTRO_TIPS = [
  'Beat the bots to earn credits!',
  'Spend credits on booster packs in the SHOP.',
  'Build your own decks in DECKS from cards the game can play.',
];

type Step = { kind: 'name' } | { kind: 'deck' } | { kind: 'tip'; index: number };

/** First-launch intro: name, starter deck, then three tips. */
export function Intro() {
  const finishIntro = useProfile((s) => s.finishIntro);
  const [step, setStep] = useState<Step>({ kind: 'name' });
  const [name, setName] = useState('');
  const [deck, setDeck] = useState<string | null>(null);

  const finish = async (n: string, d: string | null) => {
    await finishIntro(n, d);
    useNav.getState().go('menu');
  };

  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col justify-center gap-6 p-4">
      <div className="flex justify-end">
        <Button variant="plain" onClick={() => void finish(name, deck)}>
          Skip
        </Button>
      </div>
      {step.kind === 'name' && (
        <Box className="mx-auto w-full max-w-sm">
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              sfx('confirm');
              setStep({ kind: 'deck' });
            }}
          >
            <label className="flex flex-col gap-3">
              <span className="font-pixel text-xs">YOUR NAME?</span>
              <input
                aria-label="Your name"
                autoFocus
                maxLength={MAX_NAME}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border-b-4 border-ink bg-transparent px-1 py-1 font-pixel text-base uppercase outline-none"
              />
            </label>
            <Button type="submit" className="self-end">
              OK
            </Button>
          </form>
        </Box>
      )}
      {step.kind === 'deck' && (
        <>
          <div className="flex flex-wrap justify-center gap-4">
            {STARTER_DECKS.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  sfx('confirm');
                  setDeck(d.id);
                  setStep({ kind: 'tip', index: 0 });
                }}
                className="retro-shadow flex w-32 flex-col items-center gap-2 border-4 border-ink bg-paper p-2 hover:-translate-y-1"
              >
                <img src={`${registry.defs[d.cover]!.image}/low.webp`} alt="" className="w-24" />
                <span className="font-pixel text-[9px] leading-relaxed">{d.name}</span>
              </button>
            ))}
          </div>
          <DialogBox text="Pick the deck you want to start with!" />
        </>
      )}
      {step.kind === 'tip' && (
        <DialogBox
          text={INTRO_TIPS[step.index]!}
          onDone={() => {
            sfx('cursor');
            if (step.index + 1 < INTRO_TIPS.length) setStep({ kind: 'tip', index: step.index + 1 });
            else void finish(name, deck);
          }}
        />
      )}
    </main>
  );
}
