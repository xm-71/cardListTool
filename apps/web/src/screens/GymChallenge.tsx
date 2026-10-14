import { useEffect, useMemo, useState } from 'react';
import { validateGymDeck } from '@ptcg/economy';
import { sfx } from '../audio/sfx.ts';
import { deckSources, registry, type DeckSource } from '../game/catalog.ts';
import { resolveActiveDeck } from '../game/deckCase.ts';
import {
  CHAMPION_STAGE,
  JOHTO_LEADERS,
  JOHTO_TOTAL,
  LEADERS,
  badgeReward,
  canChallenge,
  canStartElite,
  championStage,
  eliteOf,
  gymStatus,
  johtoBadgeReward,
  johtoUnlocked,
  leadersOf,
  regionOf,
  type Opponent,
  type Region,
} from '../game/gym.ts';
import { runDeckSource, snapshotOf, startEliteMatch, startGymMatch } from '../game/gymMatch.ts';
import { ScreenFrame } from '../nav/ScreenFrame.tsx';
import { useNav } from '../nav/useNav.ts';
import { useProfile } from '../profile/useProfile.ts';
import { ActiveDeckPanel } from '../ui/ActiveDeckPanel.tsx';
import { CharacterPortrait } from '../ui/CharacterPortrait.tsx';
import { Box, Button, DialogBox } from '../ui/retro/index.ts';

type Setup = { kind: 'gym'; leader: Opponent } | { kind: 'elite'; region: Region };

/** The setup the player was on when they opened the Deck Case, so Back / Use this deck return to it. */
let resumeSetup: Setup | null = null;

const art = (cover: string) => `${registry.defs[cover]!.image}/low.webp`;

/** One tile per leader; `reward` is the first-win line for the gym that is next to be beaten. */
function LeaderGrid({
  label,
  leaders,
  reward,
  onChallenge,
}: {
  label: string;
  leaders: readonly Opponent[];
  reward(index: number): string;
  onChallenge(leader: Opponent): void;
}) {
  const gym = useProfile((s) => s.profile.gym);
  return (
    <ul aria-label={label} className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {leaders.map((leader, i) => {
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
            {status === 'next' && <p className="text-base opacity-70">First win: {reward(i)}</p>}
            <Button
              disabled={!canChallenge(gym.badges, leader.id)}
              aria-label={
                status === 'locked'
                  ? undefined
                  : `${status === 'beaten' ? 'Rematch' : 'Challenge'} ${leader.name}`
              }
              onClick={() => onChallenge(leader)}
            >
              {status === 'beaten' ? 'Rematch' : status === 'next' ? 'Challenge' : 'Locked'}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

/** The Johto tab: locked until the Kanto Champion has been beaten. */
function JohtoGyms({
  onChallenge,
  onStartElite,
}: {
  onChallenge(leader: Opponent): void;
  onStartElite(): void;
}) {
  const gym = useProfile((s) => s.profile.gym);
  if (!johtoUnlocked(gym)) {
    return (
      <Box title="Johto">
        <p className="text-xl">Beat the Kanto Champion to travel to Johto.</p>
      </Box>
    );
  }
  const earned = JOHTO_LEADERS.filter((l) => gym.badges.includes(l.id)).length;
  return (
    <>
      <Box title="Johto Gym Challenge">
        <p className="text-xl">
          Beat the Johto Gym Leaders in order to earn their badges. Badges: {earned} / {JOHTO_TOTAL}
        </p>
      </Box>
      <LeaderGrid
        label="Johto badge case"
        leaders={JOHTO_LEADERS}
        reward={(i) => `${johtoBadgeReward(i).credits} credits + a Mega Evolution pack`}
        onChallenge={onChallenge}
      />
      <EliteFour region="johto" onStart={onStartElite} />
      <HallOfFame region="johto" />
    </>
  );
}

/** The badge case, the Elite Four run and the Hall of Fame (Kanto), and the Johto badge case. */
export function GymChallenge() {
  const gym = useProfile((s) => s.profile.gym);
  const abandonUnfinishedRun = useProfile((s) => s.abandonUnfinishedRun);
  // No game is running here, so a run whose match never finished (quit or reload) is over.
  useEffect(() => {
    void abandonUnfinishedRun();
  }, [abandonUnfinishedRun]);
  const [setup, setSetup] = useState<Setup | null>(() => {
    const resumed = resumeSetup;
    resumeSetup = null;
    return resumed;
  });
  const [region, setRegion] = useState<Region>(
    setup?.kind === 'gym' ? (regionOf(setup.leader.id) ?? 'kanto') : (setup?.region ?? 'kanto'),
  );
  const earned = gym.badges.filter((id) => LEADERS.some((l) => l.id === id)).length;

  if (setup) return <MatchSetup setup={setup} onCancel={() => setSetup(null)} />;
  const tabs = (
    <div role="tablist" aria-label="Regions" className="flex gap-2">
      {(
        [
          ['kanto', 'Kanto'],
          ['johto', 'Johto'],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={region === id}
          onClick={() => setRegion(id)}
          className={`border-4 border-ink px-4 py-2 font-pixel text-[10px] uppercase ${region === id ? 'retro-shadow bg-yellow text-ink-fixed' : 'bg-paper hover:bg-cream'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
  const challenge = (leader: Opponent) => setSetup({ kind: 'gym', leader });
  return (
    <ScreenFrame wide actions={tabs}>
      {region === 'johto' ? (
        <JohtoGyms
          onChallenge={challenge}
          onStartElite={() => setSetup({ kind: 'elite', region: 'johto' })}
        />
      ) : (
        <>
          <Box title="Gym Challenge">
            <p className="text-xl">
              Beat the 8 Kanto Gym Leaders in order to earn their badges. With all 8 badges you can take on
              the Elite Four and the Champion in one run. Badges: {earned} / {LEADERS.length}
            </p>
          </Box>
          <LeaderGrid
            label="Badge case"
            leaders={LEADERS}
            reward={(i) => `${badgeReward(i).credits} credits + a 151 pack`}
            onChallenge={challenge}
          />
          <EliteFour region="kanto" onStart={() => setSetup({ kind: 'elite', region: 'kanto' })} />
          <HallOfFame region="kanto" />
        </>
      )}
    </ScreenFrame>
  );
}

const REGION_NAME: Record<Region, string> = { kanto: 'Kanto', johto: 'Johto' };

/** The Elite Four run of a region: the order, the state of the run and the button to start or continue it. */
function EliteFour({ region, onStart }: { region: Region; onStart(): void }) {
  const gym = useProfile((s) => s.profile.gym);
  const unlocked = canStartElite(gym.badges, region);
  const members = eliteOf(region);
  const earned = leadersOf(region).filter((l) => gym.badges.includes(l.id)).length;
  const run = gym.run;
  const mine = run && (run.region ?? 'kanto') === region ? run : null;
  const other = run && !mine ? (run.region ?? 'kanto') : null;
  return (
    <Box title="Elite Four">
      <div className="flex flex-col gap-3">
        <ol aria-label="Elite Four order" className="flex flex-wrap gap-3 text-xl">
          {members.map((o, i) => (
            <li
              key={o.id}
              aria-current={mine?.stage === i ? 'step' : undefined}
              className={`border-2 border-ink px-2 py-1 ${mine && i < mine.stage ? 'bg-green/30 line-through' : ''} ${mine?.stage === i ? 'bg-yellow text-ink-fixed' : ''}`}
            >
              <CharacterPortrait id={o.id} size={20} className="mr-1 inline-block border-2 align-middle" />
              {i + 1}. {o.name}
            </li>
          ))}
        </ol>
        {!unlocked ? (
          <p className="text-xl">
            Earn all 8 badges to enter ({earned} / {leadersOf(region).length}).
          </p>
        ) : other ? (
          <p className="text-xl">Finish your {REGION_NAME[other]} run first.</p>
        ) : mine ? (
          <p className="text-xl">
            Run in progress: next up is {members[mine.stage]!.name} (match {mine.stage + 1} of{' '}
            {members.length}). Losing a match ends the run.
          </p>
        ) : (
          <p className="text-xl">
            Pick one deck for the whole run: five matches in a row, and a loss sends you back to{' '}
            {members[0]!.name}.
          </p>
        )}
        <Button className="self-start" disabled={!unlocked || !!other} onClick={onStart}>
          {mine ? 'Continue run' : 'Start Elite Four'}
        </Button>
      </div>
    </Box>
  );
}

/** The Champions of a region, newest first (entries without a region are Kanto's). */
function HallOfFame({ region }: { region: Region }) {
  const all = useProfile((s) => s.profile.gym.hallOfFame);
  const hof = all.filter((e) => (e.region ?? 'kanto') === region);
  return (
    <Box title="Hall of Fame">
      {hof.length === 0 ? (
        <p className="text-xl">
          {region === 'johto' ? 'No Johto Champions yet.' : 'No Champions yet. Will you be the first?'}
        </p>
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
  const profile = useProfile((s) => s.profile);
  // The active deck, if it is Gym-legal and owned (resolveActiveDeck falls back otherwise).
  const activeId = resolveActiveDeck(profile);
  const active = useMemo(
    () =>
      deckSources(
        customDecks.filter(
          (d) => validateGymDeck({ name: d.name, cards: d.cards }, registry, collection).length === 0,
        ),
      ).find((d) => d.id === activeId),
    [activeId, customDecks, collection],
  );
  const region = setup.kind === 'elite' ? setup.region : 'kanto';
  const run = setup.kind === 'elite' && (gym.run?.region ?? 'kanto') === region ? gym.run : null;
  const locked = run ? runDeckSource(run.deck) : undefined;
  const opponent = setup.kind === 'gym' ? setup.leader : eliteOf(region)[run?.stage ?? 0]!;
  const choosing = !locked;
  const deck: DeckSource | undefined = locked ?? active;

  const battle = async () => {
    if (!deck) return;
    sfx('confirm');
    if (setup.kind === 'gym') return startGymMatch(setup.leader.id, deck);
    if (!run) await startEliteRun(snapshotOf(deck), region);
    // The run's saved copy of the deck is what plays, so a deck changed since the run started doesn't matter.
    const current = useProfile.getState().profile.gym.run;
    // Another tab may have started a run of the other region: that run is not ours to play or mark.
    if (current && (current.region ?? 'kanto') !== region) return;
    await startEliteMatch(current?.stage ?? 0, current ? runDeckSource(current.deck) : deck, region);
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
        {setup.kind === 'elite' && run?.stage === CHAMPION_STAGE && region === 'kanto' && (
          <p className="mt-2 text-lg opacity-70">Blue picks the ace that counters your deck's main Energy.</p>
        )}
        {setup.kind === 'elite' && run?.stage === championStage('johto') && region === 'johto' && (
          <p className="mt-2 text-lg opacity-70">Lance plays one fixed deck.</p>
        )}
      </Box>
      {choosing ? (
        <>
          {run && <p className="text-xl">Your run deck is gone. Pick another to keep going.</p>}
          <ActiveDeckPanel
            title="Your deck"
            source={deck}
            onChange={() => {
              resumeSetup = setup;
              useNav.getState().go('deckcase', 'gym');
            }}
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
