import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, test } from 'vitest';
import type { GameResult } from '@ptcg/engine';
import { gameAward, useGameAward } from '../src/game/awards.ts';
import { useGame, type GameConfig } from '../src/game/store.ts';
import { createMemoryStore } from '../src/profile/memoryStore.ts';
import { useProfile } from '../src/profile/useProfile.ts';

const cfg = (over: Partial<GameConfig> = {}): GameConfig => ({
  mode: 'bot',
  difficulty: 'medium',
  humanDeck: 'mega-gengar',
  botDeck: 'mega-diancie',
  seed: 77,
  ...over,
});
const win: GameResult = { winner: 0, reason: 'prizes' };

beforeEach(async () => {
  useGame.getState().reset();
  useProfile.getState().reset();
  await useProfile.getState().init(createMemoryStore(), true);
});

test('gameAward pays bot games by difficulty and nothing for hotseat or a human concede', () => {
  expect(gameAward(cfg(), win, 0)).toBe(200);
  expect(gameAward(cfg({ difficulty: undefined }), win, 0)).toBe(100);
  expect(gameAward(cfg({ mode: 'hotseat' }), win, 0)).toBeNull();
  expect(gameAward(cfg(), { winner: 1, reason: 'concede' }, 0)).toBe(0);
});

function finish(result: GameResult): void {
  const s = useGame.getState().state!;
  useGame.setState({ state: { ...s, result } });
}

test('(RF1) a finished bot game awards exactly once across re-renders', async () => {
  useGame.getState().start(cfg());
  const { result, rerender } = renderHook(() => useGameAward());
  expect(result.current).toBeNull();
  finish(win);
  rerender();
  rerender();
  await waitFor(() => expect(useProfile.getState().profile.credits).toBe(700));
  expect(result.current).toBe(200);
  // "Play again" with the same seed (e.g. re-render after a reload of the same game) pays nothing more.
  useGame.getState().start(cfg());
  finish(win);
  rerender();
  await waitFor(() => expect(result.current).toBe(200));
  expect(useProfile.getState().profile.credits).toBe(700);
});

test('a new game (new seed) awards again', async () => {
  useGame.getState().start(cfg());
  const { rerender } = renderHook(() => useGameAward());
  finish(win);
  rerender();
  await waitFor(() => expect(useProfile.getState().profile.credits).toBe(700));
  useGame.getState().start(cfg({ seed: 78 }));
  finish({ winner: 1, reason: 'prizes' });
  rerender();
  await waitFor(() => expect(useProfile.getState().profile.credits).toBe(750));
});
