import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { newBinder } from '../src/profile/binders.ts';
import { createMemoryStore } from '../src/profile/memoryStore.ts';
import { newProfile, type CustomBinder, type Profile } from '../src/profile/types.ts';
import { useProfile } from '../src/profile/useProfile.ts';
import { Binder } from '../src/screens/Binder.tsx';
import { useSettings } from '../src/settings/useSettings.ts';

const BALL = 'me01-131';
const LUCARIO = 'me01-077';
const owned = { [BALL]: 1, [LUCARIO]: 1 };
let store = createMemoryStore();

async function open(profile: Partial<Profile> = {}) {
  useProfile.getState().reset();
  store = createMemoryStore({ ...newProfile(), introDone: true, collection: owned, ...profile });
  await useProfile.getState().init(store, true);
  render(<Binder />);
  fireEvent.click(screen.getByRole('tab', { name: 'My binders' }));
}
const stored = async () => (await store.load()).binders[0]!;
/** Opens the only binder on the shelf. */
const openFirst = () => fireEvent.click(screen.getAllByRole('button', { name: /^Open / })[0]!);
const pick = async (slot: string, card: string) => {
  fireEvent.click(screen.getByRole('button', { name: slot }));
  const picker = await screen.findByRole('dialog', { name: 'Choose a card' });
  fireEvent.click(within(picker).getByRole('button', { name: card }));
};
const seeded = (pages: (string | null)[][]): CustomBinder => ({ ...newBinder('b1', 1), name: 'Seeded', pages });
const row = (...ids: (string | null)[]) => [...ids, ...Array<null>(9 - ids.length).fill(null)];

beforeEach(() => useSettings.getState().setSound(false));
afterEach(() => vi.restoreAllMocks());

test('All cards stays the default tab', async () => {
  useProfile.getState().reset();
  await useProfile.getState().init(createMemoryStore(), true);
  render(<Binder />);
  expect(screen.getByRole('tab', { name: 'All cards' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('list', { name: 'Cards' })).toBeInTheDocument();
});

test('New binder → Save puts a cover on the shelf; opening it shows one empty page', async () => {
  await open();
  fireEvent.click(screen.getByRole('button', { name: 'New binder' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Edit binder' })).getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(screen.getAllByTestId('binder-cover')).toHaveLength(1));
  openFirst();
  expect(screen.getByText('Page 1 / 1')).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: /^Empty slot \d+$/ })).toHaveLength(9);
});

test('picking a card fills the slot, is saved, and greys out a card with no copies left', async () => {
  await open({ binders: [seeded([row()])] });
  openFirst();
  await pick('Empty slot 1', 'Ultra Ball');
  expect(await screen.findByRole('button', { name: 'Slot 1: Ultra Ball' })).toBeInTheDocument();
  await waitFor(async () => expect((await stored()).pages[0]![0]).toBe(BALL));
  fireEvent.click(screen.getByRole('button', { name: 'Empty slot 2' }));
  const picker = await screen.findByRole('dialog', { name: 'Choose a card' });
  expect(within(picker).getByRole('button', { name: 'Ultra Ball' })).toBeDisabled();
  expect(within(picker).getByRole('button', { name: 'Mega Lucario ex' })).toBeEnabled();
  expect(within(picker).queryByRole('button', { name: 'Switch' })).toBeNull(); // not owned
});

test('pages can be added, flipped and removed (with a confirm)', async () => {
  await open({ binders: [seeded([row()])] });
  openFirst();
  fireEvent.click(screen.getByRole('button', { name: 'Add page' }));
  await waitFor(() => expect(screen.getByText('Page 1 / 2')).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  expect(screen.getByText('Page 2 / 2')).toBeInTheDocument();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: 'Remove page' }));
  await waitFor(() => expect(screen.getByText('Page 1 / 1')).toBeInTheDocument());
  expect(screen.queryByRole('button', { name: 'Remove page' })).toBeNull();
});

test('a card can be moved to another slot and removed', async () => {
  await open({ binders: [seeded([row(BALL)])] });
  openFirst();
  fireEvent.click(screen.getByRole('button', { name: 'Slot 1: Ultra Ball' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Slot 1' })).getByRole('button', { name: 'Move' }));
  fireEvent.click(screen.getByRole('button', { name: 'Move here: Empty slot 5' }));
  expect(await screen.findByRole('button', { name: 'Slot 5: Ultra Ball' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Empty slot 1' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Slot 5: Ultra Ball' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Slot 5' })).getByRole('button', { name: 'Remove' }));
  await waitFor(async () => expect((await stored()).pages[0]!.every((id) => id === null)).toBe(true));
});

test('Escape cancels a move', async () => {
  await open({ binders: [seeded([row(BALL)])] });
  openFirst();
  fireEvent.click(screen.getByRole('button', { name: 'Slot 1: Ultra Ball' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Slot 1' })).getByRole('button', { name: 'Move' }));
  act(() => void fireEvent.keyDown(window, { key: 'Escape' }));
  expect(screen.getByRole('button', { name: 'Empty slot 5' })).toBeInTheDocument();
});

test('copies beyond what you own show as missing', async () => {
  await open({ binders: [seeded([row(BALL, BALL)])] });
  openFirst();
  expect(screen.getAllByRole('button', { name: /Ultra Ball \(missing\)/ })).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Slot 2: Ultra Ball (missing)' })).toBeInTheDocument();
});

test('Back returns from an open binder to the shelf', async () => {
  await open({ binders: [seeded([row()])] });
  openFirst();
  fireEvent.click(screen.getByRole('button', { name: 'Back to binders' }));
  expect(screen.getByRole('button', { name: 'New binder' })).toBeInTheDocument();
});
