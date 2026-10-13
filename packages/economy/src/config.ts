import type { GameResult, PlayerId } from '@ptcg/engine';

/** All credit values (spec §4.4) live here. */
export const CREDITS = {
  start: 500,
  packPrice: 150,
  win: { easy: 100, medium: 200, hard: 300 },
  loss: { easy: 30, medium: 50, hard: 70 },
  /** What a premade deck costs in the Poké Mart, by kind. */
  deckPrices: { starter: 300, theme: 600, meta: 1200 },
} as const;

export type Difficulty = keyof typeof CREDITS.win;

export type PremadeKind = keyof typeof CREDITS.deckPrices;

export const deckPrice = (kind: PremadeKind): number => CREDITS.deckPrices[kind];

/** Credits for a finished bot game. A concede by the human pays nothing; a draw pays as a loss. */
export function creditsFor(result: GameResult, humanSeat: PlayerId, difficulty: Difficulty): number {
  if (result.winner === humanSeat) return CREDITS.win[difficulty];
  if (result.reason === 'concede') return 0;
  return CREDITS.loss[difficulty];
}
