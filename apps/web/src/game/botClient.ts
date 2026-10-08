import { createEasyBot } from '@ptcg/bots';
import type { Action, PlayerView } from '@ptcg/engine';
import { registry } from './catalog.ts';

export interface BotClient {
  choose(view: PlayerView, legal: Action[], rng: number): Promise<{ action: Action; rng: number }>;
}

/** Runs the bot on the main thread (tests, or browsers without module workers). */
export function createSyncBotClient(): BotClient {
  const bot = createEasyBot(registry);
  return { choose: async (view, legal, rng) => bot(view, legal, rng) };
}

/** Runs the bot in a Web Worker so the UI never freezes while it thinks. */
export function createWorkerBotClient(): BotClient {
  if (typeof Worker === 'undefined') return createSyncBotClient();
  const worker = new Worker(new URL('./bot.worker.ts', import.meta.url), { type: 'module' });
  let nextId = 0;
  const waiting = new Map<number, (r: { action: Action; rng: number }) => void>();
  worker.onmessage = (e: MessageEvent<{ id: number; action: Action; rng: number }>) => {
    waiting.get(e.data.id)?.({ action: e.data.action, rng: e.data.rng });
    waiting.delete(e.data.id);
  };
  return {
    choose(view, legal, rng) {
      const id = nextId++;
      return new Promise((resolve) => {
        waiting.set(id, resolve);
        worker.postMessage({ id, view, legal, rng });
      });
    },
  };
}
