import type { Action, PlayerView } from '@ptcg/engine';

/** A bot sees only its own view and the legal actions; randomness is threaded through `rng`. */
export type Bot = (view: PlayerView, legal: Action[], rng: number) => { action: Action; rng: number };
