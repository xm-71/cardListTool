import { useEffect, useMemo, useState } from 'react';
import type { PlayerId } from '@ptcg/engine';
import { useGameAward, useGymResult } from './game/awards.ts';
import { createWorkerBotClient, type BotClient } from './game/botClient.ts';
import { actorOf, useGame } from './game/store.ts';
import { useBotDriver } from './game/useBotDriver.ts';
import { GameScreen } from './screens/GameScreen.tsx';
import { useNav, type Route } from './nav/useNav.ts';
import { Binder } from './screens/Binder.tsx';
import { GymChallenge } from './screens/GymChallenge.tsx';
import { DeckBuilder } from './screens/DeckBuilder.tsx';
import { DuelSetup } from './screens/DuelSetup.tsx';
import { Intro } from './screens/Intro.tsx';
import { MainMenu } from './screens/MainMenu.tsx';
import { Options } from './screens/Options.tsx';
import { Shop } from './screens/Shop.tsx';
import { Title } from './screens/Title.tsx';
import { connectProfileStore, useProfile } from './profile/useProfile.ts';
import { ErrorBoundary, ErrorScreen } from './ui/ErrorScreen.tsx';
import { GameOver } from './ui/GameOver.tsx';
import { GymGameOver } from './ui/GymGameOver.tsx';
import { deckSources } from './game/catalog.ts';
import { resolveDeck, startEliteMatch, startGymMatch } from './game/gymMatch.ts';
import { PassDevice } from './ui/PassDevice.tsx';

interface Props {
  botClient?: BotClient;
  botDelayMs?: number;
  /** Screen to open on (tests skip the title with it). */
  startAt?: Route;
}

/** Seed for "Play again": a 32-bit LCG step (full period, so rematches don't repeat). */
export function nextSeed(seed: number): number {
  return (Math.imul(seed, 1103515245) + 12345) >>> 0;
}

export function App({ botClient, botDelayMs = 700, startAt }: Props) {
  useState(() => {
    if (startAt) useNav.setState({ route: startAt });
  });
  const client = useMemo(() => botClient ?? createWorkerBotClient(), [botClient]);
  useEffect(() => {
    if (useProfile.getState().ready) return;
    void connectProfileStore().then(({ store, persistent }) => useProfile.getState().init(store, persistent));
  }, []);
  return (
    <ErrorBoundary>
      <Game client={client} delay={botDelayMs} />
    </ErrorBoundary>
  );
}

function Game({ client, delay }: { client: BotClient; delay: number }) {
  useBotDriver(client, delay);
  const state = useGame((s) => s.state);
  const config = useGame((s) => s.config);
  const human = useGame((s) => s.human);
  const error = useGame((s) => s.error);
  const start = useGame((s) => s.start);
  const resetGame = useGame((s) => s.reset);
  const reset = () => {
    const toGym = !!useGame.getState().config?.context;
    resetGame();
    useNav.getState().go(toGym ? 'gym' : 'menu');
  };
  // Hotseat: the seat that has confirmed it is looking at the screen.
  const [confirmed, setConfirmed] = useState<{ game: number; seat: PlayerId } | null>(null);
  const credits = useGameAward();
  const gymPayout = useGymResult();

  if (error) return <ErrorScreen error={error} onHome={reset} />;
  if (!state || !config) return <Screens />;

  let viewer: PlayerId = human;
  if (config.mode === 'hotseat') {
    const actor = actorOf(state);
    const confirmedSeat = confirmed?.game === config.seed ? confirmed.seat : null;
    if (actor !== null && actor !== confirmedSeat) {
      return <PassDevice player={actor} onReady={() => setConfirmed({ game: config.seed, seat: actor })} />;
    }
    viewer = actor ?? confirmedSeat ?? 0;
  }
  return (
    <>
      <GameScreen viewer={viewer} />
      {state.result && config.context && (
        <GymGameOver
          context={config.context}
          result={state.result}
          human={human}
          payout={gymPayout}
          onBack={reset}
          onRematch={() => {
            if (config.context?.kind !== 'gym') return;
            const deck = resolveDeck(config.context.deck, deckSources(useProfile.getState().profile.decks));
            if (deck) startGymMatch(config.context.leaderId, deck);
          }}
          onNext={() => {
            const { run } = useProfile.getState().profile.gym;
            if (!run) return reset();
            const profile = useProfile.getState().profile;
            const sources = deckSources(profile.decks);
            const deck = resolveDeck(run.deck, sources);
            if (!deck) return reset(); // the run's deck is gone: Gym Challenge lets the player pick another
            startEliteMatch(run.stage, deck);
          }}
        />
      )}
      {state.result && !config.context && (
        <GameOver
          result={state.result}
          mode={config.mode}
          human={human}
          credits={credits}
          onAgain={() => start({ ...config, seed: nextSeed(config.seed) })}
          onHome={reset}
        />
      )}
    </>
  );
}

const SCREENS: Record<Route, () => React.JSX.Element> = {
  title: Title,
  intro: Intro,
  menu: MainMenu,
  duel: DuelSetup,
  gym: GymChallenge,
  shop: Shop,
  binder: Binder,
  decks: DeckBuilder,
  options: Options,
};

/** Screens Collector mode hides; a route that lands on one goes back to the menu. */
const BATTLE_ROUTES: readonly Route[] = ['duel', 'gym', 'decks'];

function Screens() {
  const route = useNav((s) => s.route);
  const persistent = useProfile((s) => s.persistent);
  const ready = useProfile((s) => s.ready);
  const collector = useProfile((s) => s.profile.collectorMode);
  const blocked = collector && BATTLE_ROUTES.includes(route);
  useEffect(() => {
    if (blocked) useNav.getState().go('menu');
  }, [blocked]);
  const Screen = blocked ? MainMenu : SCREENS[route];
  return (
    <div className="flex min-h-full flex-col">
      {route !== 'title' && ready && !persistent && (
        <p role="status" className="border-b-4 border-ink bg-yellow px-4 py-1 text-center text-lg">
          Progress won't be saved in this browser (storage is unavailable).
        </p>
      )}
      <div className="flex-1">
        <Screen />
      </div>
    </div>
  );
}
