import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, test } from 'vitest';
import { App } from '../src/App.tsx';
import { useGame } from '../src/game/store.ts';
import { useNav, type Route } from '../src/nav/useNav.ts';
import { createMemoryStore } from '../src/profile/memoryStore.ts';
import { newProfile, type Profile } from '../src/profile/types.ts';
import { useProfile } from '../src/profile/useProfile.ts';
import { useSettings } from '../src/settings/useSettings.ts';

const never = { choose: () => new Promise<never>(() => {}) };

async function launch(route: Route, profile: Partial<Profile> = {}) {
  useGame.getState().reset();
  useProfile.getState().reset();
  useNav.setState({ route });
  await useProfile.getState().init(createMemoryStore({ ...newProfile(), introDone: true, ...profile }), true);
  render(<App botClient={never} botDelayMs={0} />);
}

const menuItems = () =>
  within(screen.getByRole('menu', { name: 'Main menu' }))
    .getAllByRole('menuitem')
    .map((i) => i.textContent?.replace('▶', '').trim());

beforeEach(() => useSettings.getState().setSound(false));

test('Options has a Collector mode switch that saves to the profile', async () => {
  await launch('options');
  const box = screen.getByRole('checkbox', { name: 'Collector mode' });
  expect(screen.getByText('Free packs. Battling is hidden.')).toBeInTheDocument();
  fireEvent.click(box);
  await waitFor(() => expect(useProfile.getState().profile.collectorMode).toBe(true));
});

test('with Collector mode on, the menu shows only Shop, Binder and Options', async () => {
  await launch('menu', { collectorMode: true });
  expect(menuItems()).toEqual(['Shop', 'Binder', 'Options']);
});

test('turning Collector mode off brings Duel and Decks back', async () => {
  await launch('menu', { collectorMode: true });
  await act(() => useProfile.getState().setCollectorMode(false));
  expect(menuItems()).toEqual(['Duel', 'Shop', 'Binder', 'Decks', 'Options']);
});

test('the Shop gives free packs and hides credits in Collector mode', async () => {
  await launch('shop', { collectorMode: true, credits: 0 });
  const pack = screen.getByRole('group', { name: 'Mega Evolution' });
  expect(within(pack).getByText('FREE')).toBeInTheDocument();
  expect(within(pack).getByRole('button', { name: 'Buy & open' })).toBeEnabled();
  expect(screen.getByRole('banner').textContent).not.toMatch(/credits/i);
});

test.each(['duel', 'decks'] as const)(
  'in Collector mode the %s screen sends you to the menu',
  async (route) => {
    await launch(route, { collectorMode: true });
    await waitFor(() => expect(useNav.getState().route).toBe('menu'));
    expect(screen.getByRole('menu', { name: 'Main menu' })).toBeInTheDocument();
  },
);
