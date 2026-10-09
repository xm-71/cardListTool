import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, expect, test } from 'vitest';
import { setCards } from '@ptcg/cards';
import { useGame } from '../src/game/store.ts';
import { createMemoryStore } from '../src/profile/memoryStore.ts';
import { newProfile, type Profile } from '../src/profile/types.ts';
import { useProfile } from '../src/profile/useProfile.ts';
import { Binder } from '../src/screens/Binder.tsx';
import { Shop } from '../src/screens/Shop.tsx';
import { useSettings } from '../src/settings/useSettings.ts';

async function withProfile(p: Partial<Profile> = {}) {
  useGame.getState().reset();
  useProfile.getState().reset();
  await useProfile.getState().init(createMemoryStore({ ...newProfile(), ...p }), true);
}

beforeEach(() => useSettings.setState({ sound: false, skipTitle: false }));

test('the Shop has a Scarlet & Violet section with the 151 pack', async () => {
  await withProfile();
  render(<Shop />);
  const section = screen.getByRole('region', { name: 'Scarlet & Violet' });
  expect(within(section).getAllByRole('button', { name: 'Buy & open' })).toHaveLength(1);
  expect(within(section).getByRole('group', { name: 'Scarlet & Violet 151' })).toBeInTheDocument();
});

test('buying a 151 pack opens 10 cards from sv03.5', async () => {
  await withProfile();
  render(<Shop />);
  fireEvent.click(
    within(screen.getByRole('group', { name: 'Scarlet & Violet 151' })).getByRole('button', {
      name: 'Buy & open',
    }),
  );
  const opening = await screen.findByRole('dialog', { name: 'Pack opening' });
  expect(await within(opening).findByText('Card 0 of 10', {}, { timeout: 3000 })).toBeInTheDocument();
  const ids = Object.keys(useProfile.getState().profile.collection);
  expect(ids.length).toBeGreaterThan(0);
  expect(ids.every((id) => id.startsWith('sv03.5-'))).toBe(true);
  expect(useProfile.getState().profile.credits).toBe(350);
});

test('the Binder lists 151 under Scarlet & Violet, with no Playable badges yet', async () => {
  const owned = setCards('sv03.5').find((c) => c.name === 'Gyarados')!;
  await withProfile({ collection: { [owned.id]: 1 } });
  render(<Binder />);
  const picker = screen.getByRole('group', { name: 'Sets' });
  expect(within(picker).getByText('Scarlet & Violet')).toBeInTheDocument();
  fireEvent.click(within(picker).getByRole('button', { name: '151' }));
  expect(screen.getByRole('listitem', { name: `Gyarados #${owned.id.split('-')[1]}` })).toBeInTheDocument();
  expect(screen.queryAllByText('Playable')).toHaveLength(0);
});
