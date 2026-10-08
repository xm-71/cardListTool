import { createEasyBot, createMediumBot, type Bot } from '@ptcg/bots';
import type { Action, PlayerId, PlayerView } from '@ptcg/engine';
import { deckById, registry, type DeckId } from './catalog.ts';

/** Everything a bot needs to know about the game it plays in. */
export interface BotSetup {
  difficulty: 'easy' | 'medium';
  /** Deck ids for seat 0 and seat 1 (public in this game: both are picked on the home screen). */
  decks: [DeckId, DeckId];
  seat: PlayerId;
}

export interface BotClient {
  choose(
    view: PlayerView,
    legal: Action[],
    rng: number,
    setup: BotSetup,
  ): Promise<{ action: Action; rng: number }>;
}

/** Builds (and caches) the bot for a game setup. Shared by the worker and the main-thread client. */
export function botFor(): (setup: BotSetup) => Bot {
  const cache = new Map<string, Bot>();
  return (setup) => {
    const key = JSON.stringify(setup);
    let bot = cache.get(key);
    if (!bot) {
      bot =
        setup.difficulty === 'medium'
          ? createMediumBot(
              registry,
              [deckById(setup.decks[0]).list, deckById(setup.decks[1]).list],
              setup.seat,
            )
          : createEasyBot(registry);
      cache.set(key, bot);
    }
    return bot;
  };
}

/** Runs the bot on the main thread (tests, or browsers without module workers). */
export function createSyncBotClient(): BotClient {
  const get = botFor();
  return { choose: async (view, legal, rng, setup) => get(setup)(view, legal, rng) };
}

/** Runs the bot in a Web Worker so the UI never freezes while it thinks. */
export function createWorkerBotClient(): BotClient {
  if (typeof Worker === 'undefined') return createSyncBotClient();
  const worker = new Worker(new URL('./bot.worker.ts', import.meta.url), { type: 'module' });
  let nextId = 0;
  type Pending = { resolve(r: { action: Action; rng: number }): void; reject(e: Error): void };
  const waiting = new Map<number, Pending>();
  worker.onmessage = (e: MessageEvent<{ id: number; action?: Action; rng?: number; error?: string }>) => {
    const p = waiting.get(e.data.id);
    waiting.delete(e.data.id);
    if (!p) return;
    if (e.data.error) p.reject(new Error(e.data.error));
    else p.resolve({ action: e.data.action!, rng: e.data.rng! });
  };
  // A crashed worker fails every outstanding request instead of leaving the game hanging.
  const failAll = (message: string) => {
    for (const p of waiting.values()) p.reject(new Error(message));
    waiting.clear();
  };
  worker.onerror = (e) => failAll(e.message || 'bot worker crashed');
  worker.onmessageerror = () => failAll('bot worker sent an unreadable message');
  return {
    choose(view, legal, rng, setup) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        waiting.set(id, { resolve, reject });
        worker.postMessage({ id, view, legal, rng, setup });
      });
    },
  };
}
