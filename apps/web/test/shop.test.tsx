import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, test } from 'vitest';
import { App } from '../src/App.tsx';
import { createSyncBotClient } from '../src/game/botClient.ts';
import { useGame } from '../src/game/store.ts';
import { GameOver } from '../src/ui/GameOver.tsx';
import { createMemoryStore } from '../src/profile/memoryStore.ts';
import { useProfile } from '../src/profile/useProfile.ts';
import { newProfile } from '../src/profile/types.ts';

const bot = createSyncBotClient();

async function openShop(credits: number) {
  useGame.getState().reset();
  useProfile.getState().reset();
  await useProfile.getState().init(createMemoryStore({ ...newProfile(), credits }), true);
  render(<App startAt="menu" botClient={bot} botDelayMs={0} />);
  fireEvent.click(screen.getByRole('menuitem', { name: 'Shop' }));
}

beforeEach(() => useProfile.getState().reset());

test('the shop shows the balance and both packs at 150', async () => {
  await openShop(500);
  expect(screen.getByText(/¢ 500 credits/)).toBeInTheDocument();
  for (const name of ['Mega Evolution', 'Phantasmal Flames']) {
    const pack = screen.getByRole('group', { name });
    expect(within(pack).getByText('150 credits')).toBeInTheDocument();
    expect(within(pack).getByRole('button', { name: 'Buy & open' })).toBeEnabled();
  }
});

test('(RF2) Buy & open is disabled below 150 credits', async () => {
  await openShop(149);
  for (const b of screen.getAllByRole('button', { name: 'Buy & open' })) expect(b).toBeDisabled();
});

test('buying reveals the 10 cards one at a time and charges 150', async () => {
  await openShop(500);
  fireEvent.click(
    within(screen.getByRole('group', { name: 'Phantasmal Flames' })).getByRole('button', {
      name: 'Buy & open',
    }),
  );
  const opening = await screen.findByRole('dialog', { name: 'Pack opening' });
  expect(screen.getByText(/¢ 350 credits/)).toBeInTheDocument();
  expect(within(opening).getByText('Card 1 of 10')).toBeInTheDocument();
  expect(within(opening).getAllByRole('img')).toHaveLength(1);
  fireEvent.click(within(opening).getByRole('button', { name: 'Next' }));
  expect(within(opening).getByText('Card 2 of 10')).toBeInTheDocument();
  fireEvent.click(within(opening).getByRole('button', { name: 'Reveal all' }));
  expect(within(opening).getAllByRole('img')).toHaveLength(10);
  fireEvent.click(within(opening).getByRole('button', { name: 'Done' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Pack opening' })).not.toBeInTheDocument());
  const owned = Object.values(useProfile.getState().profile.collection).reduce((a, b) => a + b, 0);
  expect(owned).toBe(10);
});

test('the game-over overlay shows the credits a bot game earned', () => {
  render(
    <GameOver
      result={{ winner: 0, reason: 'prizes' }}
      mode="bot"
      human={0}
      credits={200}
      onAgain={() => {}}
      onHome={() => {}}
    />,
  );
  expect(screen.getByText('+200 credits')).toBeInTheDocument();
});

test('the game-over overlay shows no credits line for hotseat', () => {
  render(
    <GameOver
      result={{ winner: 0, reason: 'prizes' }}
      mode="hotseat"
      human={0}
      credits={null}
      onAgain={() => {}}
      onHome={() => {}}
    />,
  );
  expect(screen.queryByText(/credits/)).not.toBeInTheDocument();
});

test('a warning shows when progress cannot be saved', async () => {
  useProfile.getState().reset();
  await useProfile.getState().init(createMemoryStore(), false);
  render(<App startAt="menu" botClient={bot} botDelayMs={0} />);
  expect(screen.getByRole('status')).toHaveTextContent("Progress won't be saved in this browser");
});

test('while the profile is loading, the balance is hidden and buying is disabled', () => {
  useGame.getState().reset();
  useProfile.getState().reset();
  render(<App startAt="menu" botClient={bot} botDelayMs={0} />);
  // jsdom has no IndexedDB, but the fallback resolves asynchronously: right after render we are still loading
  expect(screen.queryByText(/500 credits/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('menuitem', { name: 'Shop' }));
  for (const b of screen.getAllByRole('button', { name: 'Buy & open' })) expect(b).toBeDisabled();
});

test('a failed purchase shows its error', async () => {
  useGame.getState().reset();
  useProfile.getState().reset();
  await useProfile
    .getState()
    .init(
      { load: () => Promise.resolve(newProfile()), save: () => Promise.reject(new Error('quota exceeded')) },
      true,
    );
  render(<App startAt="menu" botClient={bot} botDelayMs={0} />);
  fireEvent.click(screen.getByRole('menuitem', { name: 'Shop' }));
  fireEvent.click(
    within(screen.getByRole('group', { name: 'Mega Evolution' })).getByRole('button', { name: 'Buy & open' }),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent('quota exceeded');
  expect(screen.getByText(/¢ 500 credits/)).toBeInTheDocument();
});
