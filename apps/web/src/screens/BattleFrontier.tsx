import { useEffect, useState } from 'react';
import { sfx } from '../audio/sfx.ts';
import { DECKS, registry } from '../game/catalog.ts';
import type { FrontierRun } from '../game/frontier/run.ts';
import { startFrontierMatch } from '../game/frontierMatch.ts';
import { ScreenFrame } from '../nav/ScreenFrame.tsx';
import { useProfile } from '../profile/useProfile.ts';
import { FightTrack } from '../ui/frontier/FightTrack.tsx';
import { OpponentCard } from '../ui/frontier/OpponentCard.tsx';
import { RunDeckView } from '../ui/frontier/RunDeckView.tsx';
import { Box, Button } from '../ui/retro/index.ts';

/** Battle Frontier: start a run, pick a starter, then fight through the hub. */
export function BattleFrontier() {
  const run = useProfile((s) => s.profile.frontier.run);
  const settle = useProfile((s) => s.settleUnfinishedFrontierMatch);
  // No game is running here, so a fight that was started and never recorded (quit or reload) is a loss.
  useEffect(() => {
    void settle();
  }, [settle]);
  return (
    <ScreenFrame wide>
      <Box title="Battle Frontier">
        <p className="text-xl">
          Eight fights, two lives. Start from a starter deck and draft new cards after every win. Beat the
          Frontier Brain at the end to enter the Hall of Fame.
        </p>
      </Box>
      {!run ? (
        <NoRun />
      ) : run.phase === 'starter' ? (
        <StarterPick run={run} />
      ) : run.phase === 'hub' ? (
        <Hub run={run} />
      ) : (
        <p className="text-xl">{run.phase === 'reward' ? 'Choose your reward.' : 'The run is over.'}</p>
      )}
    </ScreenFrame>
  );
}

function NoRun() {
  const start = useProfile((s) => s.startFrontierRun);
  return (
    <Button
      className="self-center px-10 py-4 text-sm"
      onClick={() => {
        sfx('confirm');
        void start();
      }}
    >
      Start run
    </Button>
  );
}

function StarterPick({ run }: { run: FrontierRun }) {
  const choose = useProfile((s) => s.chooseFrontierStarter);
  return (
    <Box title="Pick your starter deck">
      <ul aria-label="Starter decks" className="grid gap-4 sm:grid-cols-3">
        {run.starterChoices.map((id) => {
          const d = DECKS.find((x) => x.id === id)!;
          return (
            <li key={id}>
              <button
                type="button"
                aria-label={`Pick ${d.name}`}
                className="retro-box flex w-full flex-col items-center gap-2 p-3 hover:bg-cream"
                onClick={() => {
                  sfx('confirm');
                  void choose(id);
                }}
              >
                <img src={`${registry.defs[d.cover]!.image}/low.webp`} alt="" className="w-28" />
                <span className="font-pixel text-[10px]">{d.name}</span>
                <span className="text-lg">{d.type}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </Box>
  );
}

function Hub({ run }: { run: FrontierRun }) {
  const abandon = useProfile((s) => s.abandonFrontierRun);
  const [showDeck, setShowDeck] = useState(false);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-pixel text-xs">Lives: {run.lives}</p>
        <FightTrack run={run} />
      </div>
      <OpponentCard opponent={run.opponents[run.fight]!} fight={run.fight} />
      <div className="flex flex-wrap gap-3">
        <Button
          className="px-8 py-3 text-sm"
          onClick={() => {
            sfx('confirm');
            void startFrontierMatch();
          }}
        >
          Fight
        </Button>
        <Button variant="plain" aria-expanded={showDeck} onClick={() => setShowDeck((v) => !v)}>
          View deck
        </Button>
        <Button
          variant="plain"
          onClick={() => {
            if (confirm('Abandon this run? You keep the credits for fights already won.')) void abandon();
          }}
        >
          Abandon run
        </Button>
      </div>
      {showDeck && <RunDeckView cards={run.deck} />}
    </>
  );
}
