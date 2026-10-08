/// <reference lib="webworker" />
import { createEasyBot } from '@ptcg/bots';
import type { Action, PlayerView } from '@ptcg/engine';
import { registry } from './catalog.ts';

const bot = createEasyBot(registry);

self.onmessage = (e: MessageEvent<{ id: number; view: PlayerView; legal: Action[]; rng: number }>) => {
  const { id, view, legal, rng } = e.data;
  self.postMessage({ id, ...bot(view, legal, rng) });
};
