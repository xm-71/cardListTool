import { useMemo, useState } from 'react';
import type { PlayerId } from '@ptcg/engine';
import { createWorkerBotClient, type BotClient } from './game/botClient.ts';
import { actorOf, useGame } from './game/store.ts';
import { useBotDriver } from './game/useBotDriver.ts';
import { GameScreen } from './screens/GameScreen.tsx';
import { Home } from './screens/Home.tsx';
import { ErrorBoundary, ErrorScreen } from './ui/ErrorScreen.tsx';
import { GameOver } from './ui/GameOver.tsx';
import { PassDevice } from './ui/PassDevice.tsx';

interface Props {
  botClient?: BotClient;
  botDelayMs?: number;
}

export function App({ botClient, botDelayMs = 700 }: Props) {
  const client = useMemo(() => botClient ?? createWorkerBotClient(), [botClient]);
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

  if (error) return <ErrorScreen error={error} onHome={reset} />;
  if (!state || !config) return <Home />;

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
          onAgain={() => start({ ...config, seed: (config.seed * 1103515245 + 12345) >>> 0 })}
          onHome={reset}
        />
      )}
    </>
  );
}
