import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { App } from '../src/App.tsx';
import { DECKS } from '../src/game/catalog.ts';
import { useGame } from '../src/game/store.ts';
import { createMemoryStore } from '../src/profile/memoryStore.ts';
import { newProfile } from '../src/profile/types.ts';
import { useProfile } from '../src/profile/useProfile.ts';

const never = { choose: () => new Promise<never>(() => {}) };

beforeEach(() => {
  useGame.getState().reset();
  useProfile.getState().reset();
});
afterEach(() => vi.restoreAllMocks());

function play(random: number) {
  vi.spyOn(Math, 'random').mockReturnValue(random);
  fireEvent.click(screen.getByRole('button', { name: 'Play' }));
  return useGame.getState().config!;
}

test('against a bot the player does not choose the opponent’s deck', () => {
  render(<App startAt="duel" botClient={never} botDelayMs={0} />);
  expect(screen.queryByRole('group', { name: "Opponent's deck" })).toBeNull();
  expect(screen.getByText(/Random: the bot plays a surprise/)).toBeInTheDocument();
});

test('the bot plays a random starter or theme deck, anything from the first to the last', () => {
  const pool = DECKS.map((d) => d.list);
  render(<App startAt="duel" botClient={never} botDelayMs={0} />);
  expect(play(0).botDeck).toBe(pool[0]);
  cleanup();
  useGame.getState().reset();
  vi.restoreAllMocks();
  render(<App startAt="duel" botClient={never} botDelayMs={0} />);
  expect(play(0.999).botDeck).toBe(pool.at(-1));
});

test('a custom deck is never picked for the bot', async () => {
  await useProfile.getState().init(
    createMemoryStore({
      ...newProfile(),
      introDone: true,
      decks: [{ id: 'd1', name: 'Mine', cards: [{ id: 'me01-077', count: 4 }] }],
    }),
    true,
  );
  render(<App startAt="duel" botClient={never} botDelayMs={0} />);
  const pool = DECKS.map((d) => d.list);
  for (const r of [0, 0.5, 0.999]) {
    expect(pool).toContain(play(r).botDeck);
    cleanup();
    useGame.getState().reset();
    vi.restoreAllMocks();
    render(<App startAt="duel" botClient={never} botDelayMs={0} />);
  }
});

test('a second player still chooses the second deck in hotseat', () => {
  render(<App startAt="duel" botClient={never} botDelayMs={0} />);
  fireEvent.click(screen.getByLabelText(/Hotseat/));
  expect(screen.getByRole('group', { name: "Opponent's deck" })).toBeInTheDocument();
});
