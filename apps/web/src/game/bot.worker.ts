/// <reference lib="webworker" />
import type { Action, PlayerView } from '@ptcg/engine';
import { botFor, type BotSetup } from './botClient.ts';

const get = botFor();

self.onmessage = (
  e: MessageEvent<{ id: number; view: PlayerView; legal: Action[]; rng: number; setup: BotSetup }>,
) => {
  const { id, view, legal, rng, setup } = e.data;
  try {
    self.postMessage({ id, ...get(setup)(view, legal, rng) });
  } catch (err) {
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};
