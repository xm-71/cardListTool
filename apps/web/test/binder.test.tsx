import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, expect, test } from 'vitest';
import { isPlayable, setCards } from '@ptcg/cards';
import { registry } from '../src/game/catalog.ts';
import { Binder } from '../src/screens/Binder.tsx';
import { createMemoryStore } from '../src/profile/memoryStore.ts';
import { useProfile } from '../src/profile/useProfile.ts';
import { newProfile } from '../src/profile/types.ts';

const me01 = setCards('me01');
const GASTLY = 'me02-054';

beforeEach(async () => {
  useProfile.getState().reset();
  await useProfile
    .getState()
    .init(createMemoryStore({ ...newProfile(), collection: { [GASTLY]: 3, [me01[0]!.id]: 1 } }), true);
});

const items = () => within(screen.getByRole('list', { name: 'Cards' })).getAllByRole('listitem');

test('lists a set in number order, defaulting to the first set', () => {
  render(<Binder />);
  const list = items();
  expect(list).toHaveLength(me01.length);
  expect(list[0]).toHaveAccessibleName(`${me01[0]!.name} #001`);
  expect(list[1]).toHaveAccessibleName(`${me01[1]!.name} #002`);
});

test('owned cards show their count and unowned cards are greyed out', () => {
  render(<Binder />);
  fireEvent.click(screen.getByRole('button', { name: 'Phantasmal Flames' }));
  const gastly = items().find((li) => li.getAttribute('aria-label') === 'Gastly #054')!;
  expect(within(gastly).getByText('×3')).toBeInTheDocument();
  expect(gastly).toHaveAttribute('data-owned', 'true');
  const unowned = items().find((li) => li.getAttribute('aria-label') !== 'Gastly #054')!;
  expect(unowned).toHaveAttribute('data-owned', 'false');
  expect(within(unowned).getByText('Not owned')).toBeInTheDocument();
});

test('playable cards show a Playable badge', () => {
  render(<Binder />);
  fireEvent.click(screen.getByRole('button', { name: 'Phantasmal Flames' }));
  const playable = setCards('me02').filter((c) => isPlayable(c, registry)).length;
  expect(screen.getAllByText('Playable')).toHaveLength(playable);
});

test('Owned only and Playable only filter the list', () => {
  render(<Binder />);
  fireEvent.click(screen.getByRole('button', { name: 'Phantasmal Flames' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Owned only' }));
  expect(items().map((li) => li.getAttribute('aria-label'))).toEqual(['Gastly #054']);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Owned only' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Playable only' }));
  expect(items()).toHaveLength(setCards('me02').filter((c) => isPlayable(c, registry)).length);
});

test('clicking a card opens Card details', () => {
  render(<Binder />);
  fireEvent.click(within(items()[0]!).getByRole('button'));
  expect(screen.getByRole('dialog', { name: 'Card details' })).toBeInTheDocument();
});

test('the Binder tab opens the binder from the menu', async () => {
  const { App } = await import('../src/App.tsx');
  const { createSyncBotClient } = await import('../src/game/botClient.ts');
  render(<App startAt="menu" botClient={createSyncBotClient()} botDelayMs={0} />);
  fireEvent.click(screen.getByRole('menuitem', { name: 'Binder' }));
  expect(screen.getByRole('list', { name: 'Cards' })).toBeInTheDocument();
});
