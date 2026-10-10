import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, expect, test } from 'vitest';
import { PACKS } from '@ptcg/economy';
import { useGame } from '../src/game/store.ts';
import { createMemoryStore } from '../src/profile/memoryStore.ts';
import { newProfile } from '../src/profile/types.ts';
import { useProfile } from '../src/profile/useProfile.ts';
import { Binder } from '../src/screens/Binder.tsx';
import { Shop } from '../src/screens/Shop.tsx';
import { useSettings } from '../src/settings/useSettings.ts';

beforeEach(async () => {
  useSettings.setState({ sound: false, skipTitle: false });
  useGame.getState().reset();
  useProfile.getState().reset();
  await useProfile.getState().init(createMemoryStore(newProfile()), true);
});

const buyButtons = () => screen.queryAllByRole('button', { name: 'Buy & open' });

test('the shop filters packs by era', () => {
  render(<Shop />);
  expect(buyButtons()).toHaveLength(PACKS.length);
  const filter = screen.getByRole('group', { name: 'Filter packs' });
  fireEvent.click(within(filter).getByRole('button', { name: 'Classic' }));
  expect(buyButtons()).toHaveLength(PACKS.filter((p) => p.era === 'classic').length);
  expect(screen.queryByRole('region', { name: 'Mega Evolution era' })).not.toBeInTheDocument();
  expect(within(filter).getByRole('button', { name: 'Classic' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(within(filter).getByRole('button', { name: 'All' }));
  expect(buyButtons()).toHaveLength(PACKS.length);
});

test('the shop searches pack names, and says when nothing matches', () => {
  render(<Shop />);
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search packs' }), { target: { value: 'neo' } });
  expect(buyButtons()).toHaveLength(4);
  expect(screen.queryByRole('region', { name: 'Mega Evolution era' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search packs' }), { target: { value: 'zzz' } });
  expect(buyButtons()).toHaveLength(0);
  expect(screen.getByText('No packs match.')).toBeInTheDocument();
});

test('the binder filters its set picker by era and search', () => {
  render(<Binder />);
  const picker = screen.getByRole('group', { name: 'Sets' });
  expect(within(picker).getByRole('button', { name: 'Base Set' })).toBeInTheDocument();
  fireEvent.click(within(picker).getByRole('button', { name: 'Mega Evolution era' }));
  expect(within(picker).queryByRole('button', { name: 'Base Set' })).not.toBeInTheDocument();
  expect(within(picker).getByRole('button', { name: 'Phantasmal Flames' })).toBeInTheDocument();
  fireEvent.click(within(picker).getByRole('button', { name: 'All' }));
  fireEvent.change(within(picker).getByRole('searchbox', { name: 'Search sets' }), {
    target: { value: 'jung' },
  });
  expect(within(picker).getByRole('button', { name: 'Jungle' })).toBeInTheDocument();
  expect(within(picker).queryByRole('button', { name: 'Fossil' })).not.toBeInTheDocument();
});
