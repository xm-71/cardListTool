import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, test } from 'vitest';
import { App } from '../src/App.tsx';
import { createSyncBotClient } from '../src/game/botClient.ts';
import { useGame } from '../src/game/store.ts';
import { createMemoryStore } from '../src/profile/memoryStore.ts';
import { newProfile, type Profile } from '../src/profile/types.ts';
import { useProfile } from '../src/profile/useProfile.ts';
import { useSettings } from '../src/settings/useSettings.ts';

const bot = createSyncBotClient();

async function openFirstPack(profile: Partial<Profile>) {
  useGame.getState().reset();
  useProfile.getState().reset();
  await useProfile.getState().init(createMemoryStore({ ...newProfile(), introDone: true, ...profile }), true);
  render(<App startAt="menu" botClient={bot} botDelayMs={0} />);
  fireEvent.click(screen.getByRole('menuitem', { name: 'Shop' }));
  fireEvent.click(
    within(screen.getByRole('group', { name: 'Phantasmal Flames' })).getByRole('button', {
      name: 'Buy & open',
    }),
  );
  const opening = await screen.findByRole('dialog', { name: 'Pack opening' });
  await within(opening).findByText('Card 0 of 10', {}, { timeout: 3000 });
  fireEvent.click(within(opening).getByRole('button', { name: 'Reveal all' }));
  return opening;
}

const owned = () => Object.values(useProfile.getState().profile.collection).reduce((a, b) => a + b, 0);

beforeEach(() => useSettings.getState().setSound(false));

test('with the credits, the same pack can be opened again without going back to the Shop', async () => {
  const opening = await openFirstPack({ credits: 500 });
  const again = within(opening).getByRole('button', { name: 'Open another Phantasmal Flames (150 credits)' });
  expect(again).toBeEnabled();
  fireEvent.click(again);
  // a fresh opening starts: the pack shakes, then 10 new cards wait to be flipped
  expect(await screen.findByText('Card 0 of 10', {}, { timeout: 4000 })).toBeInTheDocument();
  const next = screen.getByRole('dialog', { name: 'Pack opening' });
  expect(screen.getByText(/¢ 200 credits/)).toBeInTheDocument();
  expect(owned()).toBe(20);
  fireEvent.click(within(next).getByRole('button', { name: 'Reveal all' }));
  fireEvent.click(within(next).getByRole('button', { name: 'Done' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Pack opening' })).not.toBeInTheDocument());
});

test('without enough credits for another pack the button is disabled', async () => {
  const opening = await openFirstPack({ credits: 200 });
  expect(
    within(opening).getByRole('button', { name: 'Open another Phantasmal Flames (150 credits)' }),
  ).toBeDisabled();
});

test('in Collector mode another pack is always one click away, with no price', async () => {
  const opening = await openFirstPack({ credits: 0, collectorMode: true });
  const again = within(opening).getByRole('button', { name: 'Open another Phantasmal Flames' });
  expect(again).toBeEnabled();
  fireEvent.click(again);
  await screen.findByText('Card 0 of 10', {}, { timeout: 4000 });
  expect(owned()).toBe(20);
});
