import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, expect, test } from 'vitest';
import { App } from '../src/App.tsx';
import { DECKS } from '../src/game/catalog.ts';
import { useGame } from '../src/game/store.ts';
import { useNav } from '../src/nav/useNav.ts';
import { createMemoryStore } from '../src/profile/memoryStore.ts';
import { newProfile, type Profile } from '../src/profile/types.ts';
import { useProfile } from '../src/profile/useProfile.ts';
import { useSettings } from '../src/settings/useSettings.ts';

const never = { choose: () => new Promise<never>(() => {}) };
const theme = DECKS.find((d) => d.kind === 'theme')!;
const total = (c: Record<string, number>) => Object.values(c).reduce((a, b) => a + b, 0);

async function launch(profile: Partial<Profile> = {}) {
  useGame.getState().reset();
  useProfile.getState().reset();
  useNav.setState({ route: 'shop' });
  await act(() =>
    useProfile
      .getState()
      .init(
        createMemoryStore({ ...newProfile(), introDone: true, ownedDecks: ['mega-gengar'], ...profile }),
        true,
      ),
  );
  render(<App botClient={never} botDelayMs={0} />);
}

const openDecks = () => fireEvent.click(screen.getByRole('tab', { name: 'Decks' }));
const view = (name: string) => fireEvent.click(screen.getByRole('button', { name: `View ${name}` }));

beforeEach(() => useSettings.getState().setSound(false));

test('the Decks tab lists 15 decks in three groups, with prices and OWNED on the starter', async () => {
  await launch({ credits: 5000 });
  openDecks();
  const group = (title: string) => within(screen.getByRole('region', { name: title }));
  expect(group('Starter decks').getAllByRole('button')).toHaveLength(3);
  expect(group('Theme decks').getAllByRole('button')).toHaveLength(6);
  expect(group('Meta decks').getAllByRole('button')).toHaveLength(6);
  expect(screen.getByRole('button', { name: 'View Mega Gengar ex' })).toHaveTextContent('OWNED');
  expect(screen.getByRole('button', { name: 'View Mega Diancie ex' })).toHaveTextContent('300 credits');
  expect(screen.getByRole('button', { name: `View ${theme.name}` })).toHaveTextContent('600 credits');
  expect(screen.getByRole('button', { name: 'View Dragapult ex' })).toHaveTextContent('1,200 credits');
});

test('a deck shows its full 60-card list', async () => {
  await launch({ credits: 5000 });
  openDecks();
  view(theme.name);
  const sheet = screen.getByRole('dialog', { name: theme.name });
  const list = within(sheet).getByRole('region', { name: 'Deck list' });
  const counts = within(list)
    .getAllByTestId('deck-count')
    .map((e) => Number(e.textContent!.replace('×', '')));
  expect(counts.reduce((a, b) => a + b, 0)).toBe(60);
});

test('buying a theme deck charges 600, marks it OWNED and adds its cards', async () => {
  await launch({ credits: 1000 });
  const before = total(useProfile.getState().profile.collection);
  openDecks();
  view(theme.name);
  const sheet = screen.getByRole('dialog', { name: theme.name });
  await act(
    async () => void fireEvent.click(within(sheet).getByRole('button', { name: 'Buy for 600 credits' })),
  );
  expect(
    await within(sheet).findByText('Added to your decks. 60 cards added to your binder.'),
  ).toBeInTheDocument();
  expect(within(sheet).queryByRole('button', { name: /^Buy for/ })).toBeNull();
  const p = useProfile.getState().profile;
  expect(p.credits).toBe(400);
  expect(p.ownedDecks).toContain(theme.id);
  expect(total(p.collection)).toBe(before + 60);
  fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
  expect(screen.getByRole('button', { name: `View ${theme.name}` })).toHaveTextContent('OWNED');
});

test('after buying, focus moves to the confirmation instead of being lost', async () => {
  await launch({ credits: 1000 });
  openDecks();
  view(theme.name);
  const sheet = screen.getByRole('dialog', { name: theme.name });
  await act(
    async () => void fireEvent.click(within(sheet).getByRole('button', { name: 'Buy for 600 credits' })),
  );
  const status = await within(sheet).findByText('Added to your decks. 60 cards added to your binder.');
  expect(status).toHaveFocus();
});

test('the buy button reads Not enough credits and is disabled below the price', async () => {
  await launch({ credits: 599 });
  openDecks();
  view(theme.name);
  const sheet = screen.getByRole('dialog', { name: theme.name });
  expect(within(sheet).getByRole('button', { name: 'Not enough credits' })).toBeDisabled();
});

test('Collector mode has no Decks tab', async () => {
  await launch({ collectorMode: true });
  expect(screen.queryByRole('tab', { name: 'Decks' })).toBeNull();
  expect(screen.queryByRole('tablist')).toBeNull();
});

test('a second press while buying does not charge twice', async () => {
  await launch({ credits: 2000 });
  openDecks();
  view(theme.name);
  const sheet = screen.getByRole('dialog', { name: theme.name });
  const buy = within(sheet).getByRole('button', { name: 'Buy for 600 credits' });
  await act(async () => {
    fireEvent.click(buy);
    fireEvent.click(buy);
  });
  expect(useProfile.getState().profile.credits).toBe(1400);
  expect(screen.queryByRole('alert')).toBeNull();
});

test('Packs stays the first tab and shows the packs as before', async () => {
  await launch({ credits: 500 });
  expect(screen.getByRole('tab', { name: 'Packs' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getAllByRole('button', { name: 'Buy & open' }).length).toBeGreaterThan(0);
});
