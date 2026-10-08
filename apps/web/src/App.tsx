import { useEffect, useMemo, useState } from 'react';
import type { PlayerId } from '@ptcg/engine';
import { useGameAward } from './game/awards.ts';
import { createWorkerBotClient, type BotClient } from './game/botClient.ts';
import { actorOf, useGame } from './game/store.ts';
import { useBotDriver } from './game/useBotDriver.ts';
import { GameScreen } from './screens/GameScreen.tsx';
import { Binder } from './screens/Binder.tsx';
import { DeckBuilder } from './screens/DeckBuilder.tsx';
import { Home } from './screens/Home.tsx';
import { Shop } from './screens/Shop.tsx';
import { connectProfileStore, useProfile } from './profile/useProfile.ts';
import { ErrorBoundary, ErrorScreen } from './ui/ErrorScreen.tsx';
import { GameOver } from './ui/GameOver.tsx';
import { PassDevice } from './ui/PassDevice.tsx';

interface Props {
  botClient?: BotClient;
  botDelayMs?: number;
}

/** Seed for "Play again": a 32-bit LCG step (full period, so rematches don't repeat). */
export function nextSeed(seed: number): number {
  return (Math.imul(seed, 1103515245) + 12345) >>> 0;
}

export function App({ botClient, botDelayMs = 700 }: Props) {
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
  const reset = useGame((s) => s.reset);
  // Hotseat: the seat that has confirmed it is looking at the screen.
  const [confirmed, setConfirmed] = useState<{ game: number; seat: PlayerId } | null>(null);
  const credits = useGameAward();

  if (error) return <ErrorScreen error={error} onHome={reset} />;
  if (!state || !config) return <Menu />;

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
      {state.result && (
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

const SCREENS = [
  ['home', 'Home'],
  ['shop', 'Shop'],
  ['binder', 'Binder'],
  ['decks', 'Decks'],
] as const;
type MenuScreen = (typeof SCREENS)[number][0];

function Menu() {
  const [screen, setScreen] = useState<MenuScreen>('home');
  const credits = useProfile((s) => s.profile.credits);
  const persistent = useProfile((s) => s.persistent);
  const ready = useProfile((s) => s.ready);
  return (
    <div className="flex min-h-full flex-col">
      <nav className="flex items-center gap-2 border-b border-white/10 px-4 py-2">
        {SCREENS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-current={screen === id ? 'page' : undefined}
            onClick={() => setScreen(id)}
            className={`rounded-lg px-3 py-1.5 ${screen === id ? 'bg-white/15 font-semibold' : 'hover:bg-white/10'}`}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto font-semibold text-amber-300">
          {ready ? `${credits} credits` : 'Loading…'}
        </span>
      </nav>
      {ready && !persistent && (
        <p role="status" className="bg-amber-500/20 px-4 py-1 text-center text-sm text-amber-100">
          Progress won't be saved in this browser (storage is unavailable).
        </p>
      )}
      <div className="flex-1 p-4">
        {screen === 'home' && <Home />}
        {screen === 'shop' && <Shop />}
        {screen === 'binder' && <Binder />}
        {screen === 'decks' && <DeckBuilder />}
      </div>
    </div>
  );
}
