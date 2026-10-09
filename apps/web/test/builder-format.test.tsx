import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, expect, test } from 'vitest';
import { App } from '../src/App.tsx';
import { DeckBuilder } from '../src/screens/DeckBuilder.tsx';
import { useGame } from '../src/game/store.ts';
import { createMemoryStore } from '../src/profile/memoryStore.ts';
import { newProfile, type CustomDeck } from '../src/profile/types.ts';
import { useProfile } from '../src/profile/useProfile.ts';

const GASTLY = 'me02-054';
const GEODUDE = 'sv03.5-074'; // a 151 card: Gym-legal, not Standard-legal
const FIGHTING = 'mee-006';

const standard: CustomDeck = {
  id: 'std',
  name: 'Ghost Party',
  cards: [
    { id: GASTLY, count: 4 },
    { id: 'mee-005', count: 56 },
  ],
};
const gym: CustomDeck = {
  id: 'gym',
  name: 'Rock Party',
  cards: [
    { id: GEODUDE, count: 4 },
    { id: FIGHTING, count: 56 },
  ],
};

async function setProfile(decks: CustomDeck[]) {
  useProfile.getState().reset();
  await useProfile.getState().init(
    createMemoryStore({
      ...newProfile(),
      introDone: true,
      collection: { [GASTLY]: 4, [GEODUDE]: 4 },
      decks,
    }),
    true,
  );
}

beforeEach(() => useGame.getState().reset());

test('saved decks are labelled Standard, or Gym only when they hold 151 cards', async () => {
  await setProfile([standard, gym]);
  render(<DeckBuilder />);
  const list = screen.getByRole('list', { name: 'Saved decks' });
  const rows = within(list).getAllByRole('listitem');
  expect(within(rows[0]!).getByText('Standard')).toBeInTheDocument();
  expect(within(rows[1]!).getByText('Gym only')).toBeInTheDocument();
});

test('the editor accepts owned 151 cards, labels the deck Gym only, and saves it', async () => {
  await setProfile([]);
  render(<DeckBuilder />);
  fireEvent.click(screen.getByRole('button', { name: 'New deck' }));
  expect(screen.getByText('Standard')).toBeInTheDocument();
  const available = screen.getByRole('list', { name: 'Available cards' });
  for (let i = 0; i < 4; i++) fireEvent.click(within(available).getByRole('button', { name: 'Add Geodude' }));
  expect(screen.getByText('Gym only')).toBeInTheDocument();
  for (let i = 0; i < 56; i++)
    fireEvent.click(within(available).getByRole('button', { name: 'Add Fighting Energy' }));
  expect(screen.getByRole('button', { name: 'Save deck' })).toBeEnabled();
});

test('the Duel picker only offers Standard custom decks', async () => {
  await setProfile([standard, gym]);
  render(<App startAt="duel" botClient={{ choose: () => new Promise(() => {}) }} botDelayMs={0} />);
  const custom = within(screen.getByRole('group', { name: 'Your deck' })).getByRole('group', {
    name: 'Custom decks',
  });
  expect(within(custom).getByText('Ghost Party')).toBeInTheDocument();
  expect(within(custom).queryByText('Rock Party')).toBeNull();
});
