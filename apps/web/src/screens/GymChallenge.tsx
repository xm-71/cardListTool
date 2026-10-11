import { useEffect, useMemo, useState } from 'react';
import { validateGymDeck } from '@ptcg/economy';
import { sfx } from '../audio/sfx.ts';
import { deckSources, registry, type DeckSource } from '../game/catalog.ts';
import {
  CHAMPION_STAGE,
  ELITE,
  LEADERS,
  badgeReward,
  canChallenge,
  canStartElite,
  gymStatus,
  type Opponent,
} from '../game/gym.ts';
import { runDeckSource, snapshotOf, startEliteMatch, startGymMatch } from '../game/gymMatch.ts';
import { ScreenFrame } from '../nav/ScreenFrame.tsx';
import { useProfile } from '../profile/useProfile.ts';
import { DeckChoice } from '../ui/DeckChoice.tsx';
import { CharacterPortrait } from '../ui/CharacterPortrait.tsx';
import { Box, Button, DialogBox } from '../ui/retro/index.ts';

type Setup = { kind: 'gym'; leader: Opponent } | { kind: 'elite' };

const art = (cover: string) => `${registry.defs[cover]!.image}/low.webp`;

/** The badge case, the Elite Four run and the Hall of Fame. */
export function GymChallenge() {
  const gym = useProfile((s) => s.profile.gym);
  const abandonUnfinishedRun = useProfile((s) => s.abandonUnfinishedRun);
  // No game is running here, so a run whose match never finished (quit or reload) is over.
  useEffect(() => {
    void abandonUnfinishedRun();
  }, [abandonUnfinishedRun]);
  const [setup, setSetup] = useState<Setup | null>(null);
  const earned = gym.badges.length;

  if (setup) return <MatchSetup setup={setup} onCancel={() => setSetup(null)} />;
  return (
    <ScreenFrame wide>
      <Box title="Gym Challenge">
        <p className="text-xl">
          Beat the 8 Kanto Gym Leaders in order to earn their badges. With all 8 badges you can take on the
          Elite Four and the Champion in one run. Badges: {earned} / {LEADERS.length}
        </p>
      </Box>
      <ul aria-label="Badge case" className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {LEADERS.map((leader, i) => {
          const status = gymStatus(gym.badges, leader.id);
          return (
            <li
              key={leader.id}
              aria-label={leader.name}
              className={`retro-box flex flex-col items-center gap-2 p-3 text-center ${status === 'locked' ? 'opacity-60' : ''}`}
            >
              <CharacterPortrait id={leader.id} size={80} />
              <h3 className="font-pixel text-[10px]">{leader.name}</h3>
              <p className="text-lg">{leader.type}</p>
              <p className={`font-pixel text-[8px] ${status === 'beaten' ? 'text-green-fg' : 'opacity-70'}`}>
                {status === 'beaten' ? `★ ${leader.badge} Badge` : `${leader.badge} Badge`}
              </p>
              {status === 'next' && (
                <p className="text-base opacity-70">
                  First win: {badgeReward(i).credits} credits + a 151 pack
                </p>
              )}
              <Button
                disabled={!canChallenge(gym.badges, leader.id)}
                aria-label={
                  status === 'locked'
                    ? undefined
                    : `${status === 'beaten' ? 'Rematch' : 'Challenge'} ${leader.name}`
                }
                onClick={() => setSetup({ kind: 'gym', leader })}
              >
                {status === 'beaten' ? 'Rematch' : status === 'next' ? 'Challenge' : 'Locked'}
              </Button>
            </li>
          );
        })}
      </ul>
      <EliteFour onStart={() => setSetup({ kind: 'elite' })} />
      <HallOfFame />
    </ScreenFrame>
  );
}

function EliteFour({ onStart }: { onStart(): void }) {
  const gym = useProfile((s) => s.profile.gym);
  const unlocked = canStartElite(gym.badges);
  const run = gym.run;
  return (
    <Box title="Elite Four">
      <div className="flex flex-col gap-3">
        <ol aria-label="Elite Four order" className="flex flex-wrap gap-3 text-xl">
          {ELITE.map((o, i) => (
            <li
              key={o.id}
              aria-current={run?.stage === i ? 'step' : undefined}
              className={`border-2 border-ink px-2 py-1 ${run && i < run.stage ? 'bg-green/30 line-through' : ''} ${run?.stage === i ? 'bg-yellow text-ink-fixed' : ''}`}
            >
              <CharacterPortrait id={o.id} size={20} className="mr-1 inline-block border-2 align-middle" />
              {i + 1}. {o.name}
            </li>
          ))}
        </ol>
        {!unlocked ? (
          <p className="text-xl">Earn all 8 badges to enter ({gym.badges.length} / 8).</p>
        ) : run ? (
          <p className="text-xl">
            Run in progress: next up is {ELITE[run.stage]!.name} (match {run.stage + 1} of {ELITE.length}).
            Losing a match ends the run.
          </p>
        ) : (
          <p className="text-xl">
            Pick one deck for the whole run: five matches in a row, and a loss sends you back to Lorelei.
          </p>
        )}
        <Button className="self-start" disabled={!unlocked} onClick={onStart}>
          {run ? 'Continue run' : 'Start Elite Four'}
        </Button>
      </div>
    </Box>
  );
}

function HallOfFame() {
  const hof = useProfile((s) => s.profile.gym.hallOfFame);
  return (
    <Box title="Hall of Fame">
      {hof.length === 0 ? (
        <p className="text-xl">No Champions yet. Will you be the first?</p>
      ) : (
        <ol aria-label="Hall of Fame" className="flex flex-col gap-2">
          {hof.map((e, i) => (
            <li key={i} className="flex items-center gap-3 border-b-2 border-ink/20 pb-2 text-xl">
              {registry.defs[e.cover] && <img src={art(e.cover)} alt="" className="w-10" />}
              <span className="font-pixel text-[10px]">{e.playerName}</span>
              <span>{e.deckName}</span>
              <span className="ml-auto opacity-70">{e.date}</span>
            </li>
          ))}
        </ol>
      )}
    </Box>
  );
}

/** The leader's intro, the deck pick (locked during a run) and the Battle button. */
function MatchSetup({ setup, onCancel }: { setup: Setup; onCancel(): void }) {
  const customDecks = useProfile((s) => s.profile.decks);
  const collection = useProfile((s) => s.profile.collection);
  const gym = useProfile((s) => s.profile.gym);
  const startEliteRun = useProfile((s) => s.startEliteRun);
  const starter = useProfile((s) => s.profile.starterDeck);
  // Custom decks that are not Gym-legal (or no longer owned) are left out.
  const decks = useMemo(
    () =>
      deckSources(
        customDecks.filter(
          (d) => validateGymDeck({ name: d.name, cards: d.cards }, registry, collection).length === 0,
        ),
      ),
    [customDecks, collection],
  );
  const run = setup.kind === 'elite' ? gym.run : null;
  const locked = run ? runDeckSource(run.deck) : undefined;
  const [picked, setPicked] = useState(starter ?? 'mega-gengar');
  const opponent = setup.kind === 'gym' ? setup.leader : ELITE[run?.stage ?? 0]!;
  const choosing = !locked;
  const deck: DeckSource | undefined = locked ?? decks.find((d) => d.id === picked) ?? decks[0];

  const battle = async () => {
    if (!deck) return;
    sfx('confirm');
    if (setup.kind === 'gym') return startGymMatch(setup.leader.id, deck);
    if (!run) await startEliteRun(snapshotOf(deck));
    // The run's saved copy of the deck is what plays, so a deck changed since the run started doesn't matter.
    const current = useProfile.getState().profile.gym.run;
    await startEliteMatch(current?.stage ?? 0, current ? runDeckSource(current.deck) : deck);
  };

  return (
    <ScreenFrame>
      <Box title={setup.kind === 'gym' ? `${opponent.name}'s Gym` : opponent.name}>
        <div className="flex flex-wrap items-center gap-4">
          <CharacterPortrait id={opponent.id} name={opponent.name} size={96} />
          <div className="min-w-60 flex-1">
            <DialogBox text={opponent.intro} />
          </div>
        </div>
        {setup.kind === 'elite' && run?.stage === CHAMPION_STAGE && (
          <p className="mt-2 text-lg opacity-70">Blue picks the ace that counters your deck's main Energy.</p>
        )}
      </Box>
      {choosing ? (
        <>
          {run && <p className="text-xl">Your run deck is gone. Pick another to keep going.</p>}
          <DeckChoice
            label="Your deck"
            group="Your deck"
            decks={decks}
            value={deck?.id ?? ''}
            onChange={setPicked}
          />
        </>
      ) : (
        <Box title="Your deck">
          <p className="text-xl">{locked.name} (locked for this run)</p>
        </Box>
      )}
      <div className="flex gap-3 self-center">
        <Button className="px-10 py-4 text-sm" disabled={!deck} onClick={() => void battle()}>
          Battle!
        </Button>
        <Button variant="plain" onClick={onCancel}>
          Back
        </Button>
      </div>
    </ScreenFrame>
  );
}
