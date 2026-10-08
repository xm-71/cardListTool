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
  type Pending = { resolve(r: { action: Action; rng: number }): void; reject(e: Error): void };
  const waiting = new Map<number, Pending>();
  worker.onmessage = (e: MessageEvent<{ id: number; action: Action; rng: number }>) => {
    waiting.get(e.data.id)?.resolve({ action: e.data.action, rng: e.data.rng });
    waiting.delete(e.data.id);
  };
  // A crashed worker fails every outstanding request instead of leaving the game hanging.
  const failAll = (message: string) => {
    for (const p of waiting.values()) p.reject(new Error(message));
    waiting.clear();
  };
  worker.onerror = (e) => failAll(e.message || 'bot worker crashed');
  worker.onmessageerror = () => failAll('bot worker sent an unreadable message');
  return {
    choose(view, legal, rng) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        waiting.set(id, { resolve, reject });
        worker.postMessage({ id, view, legal, rng });
      });
    },
  };
}
