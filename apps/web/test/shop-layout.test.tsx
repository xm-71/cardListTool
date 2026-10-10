import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { PACKS, packContents } from '@ptcg/economy';
import { setCards } from '@ptcg/cards';
import { Shop } from '../src/screens/Shop.tsx';
import { useGame } from '../src/game/store.ts';
import { createMemoryStore } from '../src/profile/memoryStore.ts';
import { newProfile, type Profile } from '../src/profile/types.ts';
import { useProfile } from '../src/profile/useProfile.ts';

const media = (phone: boolean) =>
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('max-width') ? phone : false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));

async function shop(p: Partial<Profile> = {}) {
  useGame.getState().reset();
  useProfile.getState().reset();
  await useProfile.getState().init(createMemoryStore({ ...newProfile(), ...p }), true);
  render(<Shop />);
}
const base1 = setCards('base1');
const owned = Object.fromEntries(base1.slice(0, 34).map((c) => [c.id, 1]));

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('desktop: era list, pack grid and detail panel', () => {
  beforeEach(() => media(false));

  test('the era list counts the packs of each era and filters the grid', async () => {
    await shop();
    const list = screen.getByRole('group', { name: 'Filter packs' });
    expect(within(list).getByRole('button', { name: 'Classic' })).toHaveTextContent('12');
    expect(within(list).getByRole('button', { name: 'EX' })).toHaveTextContent('16');
    expect(within(list).getByRole('button', { name: 'All' })).toHaveTextContent(String(PACKS.length));
    fireEvent.click(within(list).getByRole('button', { name: 'Classic' }));
    expect(screen.getAllByRole('button', { name: 'Buy & open' })).toHaveLength(12);
    expect(screen.getByText('Classic · 12 packs · 100¢ each')).toBeInTheDocument();
  });

  test('the detail panel starts on the first pack and follows the selected tile', async () => {
    await shop();
    const panel = screen.getByRole('complementary', { name: 'Pack details' });
    expect(within(panel).getByRole('heading', { name: 'Mega Evolution' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Select Base Set' }));
    expect(screen.getByRole('button', { name: 'Select Base Set' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(panel).getByRole('heading', { name: 'Base Set' })).toBeInTheDocument();
    expect(within(panel).getByText(packContents('base1'))).toBeInTheDocument();
    expect(within(panel).getByText('100 credits')).toBeInTheDocument();
  });

  test('the panel shows how much of the set you own', async () => {
    await shop({ collection: owned });
    fireEvent.click(screen.getByRole('button', { name: 'Select Base Set' }));
    const panel = screen.getByRole('complementary', { name: 'Pack details' });
    expect(within(panel).getByText(`34 / ${base1.length} collected`)).toBeInTheDocument();
    expect(within(panel).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '34');
    expect(
      within(screen.getByRole('group', { name: 'Base Set' })).getByText(`34 / ${base1.length}`),
    ).toBeInTheDocument();
  });

  test('the panel Buy button buys the selected pack', async () => {
    await shop();
    fireEvent.click(screen.getByRole('button', { name: 'Select Base Set' }));
    fireEvent.click(
      within(screen.getByRole('complementary', { name: 'Pack details' })).getByRole('button', {
        name: 'Buy Base Set',
      }),
    );
    await waitFor(() => expect(useProfile.getState().profile.credits).toBe(400));
  });

  test('a tile Buy button still buys that pack in one click', async () => {
    await shop();
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Base Set' })).getByRole('button', { name: 'Buy & open' }),
    );
    await waitFor(() => expect(useProfile.getState().profile.credits).toBe(400));
  });

  test('when the filter hides the selected pack the panel moves to the first shown pack', async () => {
    await shop();
    fireEvent.click(screen.getByRole('button', { name: 'Select Base Set' }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search packs' }), { target: { value: 'Sky' } });
    expect(
      within(screen.getByRole('complementary', { name: 'Pack details' })).getByRole('heading', {
        name: 'Skyridge',
      }),
    ).toBeInTheDocument();
  });

  test('Collector mode shows FREE in the panel', async () => {
    await shop({ collectorMode: true });
    expect(
      within(screen.getByRole('complementary', { name: 'Pack details' })).getByText('FREE'),
    ).toBeInTheDocument();
  });
});

describe('phone: a list of packs with a pack sheet', () => {
  beforeEach(() => media(true));

  test('every pack is a row with its price, progress and Buy button', async () => {
    await shop({ collection: owned });
    const row = screen.getByRole('group', { name: 'Base Set' });
    expect(within(row).getByText('100 credits')).toBeInTheDocument();
    expect(within(row).getByText(`34 / ${base1.length}`)).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Buy & open' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Buy & open' })).toHaveLength(PACKS.length);
    expect(screen.queryByRole('complementary', { name: 'Pack details' })).toBeNull();
  });

  test('tapping a row opens the pack sheet; Escape closes it', async () => {
    await shop({ collection: owned });
    fireEvent.click(screen.getByRole('button', { name: 'Details for Base Set' }));
    const sheet = screen.getByRole('dialog', { name: 'Base Set' });
    expect(within(sheet).getByText(packContents('base1'))).toBeInTheDocument();
    expect(within(sheet).getByText(`34 / ${base1.length} collected`)).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Base Set' })).toBeNull();
  });

  test('buying from the sheet closes it and opens the pack', async () => {
    await shop();
    fireEvent.click(screen.getByRole('button', { name: 'Details for Base Set' }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Base Set' })).getByRole('button', { name: 'Buy Base Set' }),
    );
    await waitFor(() => expect(useProfile.getState().profile.credits).toBe(400));
    expect(screen.queryByRole('dialog', { name: 'Base Set' })).toBeNull();
  });

  test('the row Buy button buys without opening the sheet', async () => {
    await shop();
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Base Set' })).getByRole('button', { name: 'Buy & open' }),
    );
    await waitFor(() => expect(useProfile.getState().profile.credits).toBe(400));
  });
});
