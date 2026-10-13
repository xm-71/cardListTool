import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { App } from '../src/App.tsx';
import { DECKS } from '../src/game/catalog.ts';
import { LEADERS } from '../src/game/gym.ts';
import { useGame } from '../src/game/store.ts';
import { useNav, type Route } from '../src/nav/useNav.ts';
import { createMemoryStore } from '../src/profile/memoryStore.ts';
import { newProfile, type Profile } from '../src/profile/types.ts';
import { useProfile } from '../src/profile/useProfile.ts';
import { useSettings } from '../src/settings/useSettings.ts';

const never = { choose: () => new Promise<never>(() => {}) };
const theme = DECKS.find((d) => d.kind === 'theme')!;

async function launch(route: Route, profile: Partial<Profile> = {}) {
  useGame.getState().reset();
  useProfile.getState().reset();
  useNav.setState({ route });
  await act(() =>
    useProfile.getState().init(createMemoryStore({ ...newProfile(), introDone: true, ...profile }), true),
  );
  render(<App botClient={never} botDelayMs={0} />);
}

const yours = () => screen.getByRole('group', { name: 'Your deck' });
const names = (group: HTMLElement) =>
  within(group)
    .queryAllByRole('button')
    .map((b) => b.textContent);

beforeEach(() => useSettings.getState().setSound(false));
afterEach(() => vi.restoreAllMocks());

test('Duel lists only owned premade decks', async () => {
  await launch('duel', { ownedDecks: ['mega-gengar'] });
  expect(names(yours())).toEqual(['Mega Gengar ex']);
  expect(within(yours()).queryByRole('group', { name: 'Theme decks' })).toBeNull();
});

test('Duel lists a bought deck after the starter, then valid custom decks', async () => {
  await launch('duel', {
    ownedDecks: ['mega-gengar', theme.id],
    collection: { 'sv03.5-074': 4 },
    decks: [
      {
        id: 'rock',
        name: 'Rock Party',
        cards: [
          { id: 'sv03.5-074', count: 4 },
          { id: 'mee-006', count: 56 },
        ],
      },
    ],
  });
  const list = names(yours());
  expect(list).toContain('Mega Gengar ex');
  expect(list).toContain(theme.name);
  expect(list).not.toContain('Mega Diancie ex');
});

test('hotseat player 2 can pick any premade deck', async () => {
  await launch('duel', { ownedDecks: ['mega-gengar'] });
  fireEvent.click(screen.getByLabelText(/Hotseat/));
  const p2 = screen.getByRole('group', { name: "Opponent's deck" });
  const count = (title: string) =>
    within(within(p2).getByRole('group', { name: title })).getAllByRole('button');
  expect(count('Starter decks')).toHaveLength(3);
  expect(count('Theme decks')).toHaveLength(6);
  expect(count('Meta decks')).toHaveLength(6);
});

test('bots still play every premade deck, owned or not', async () => {
  await launch('duel', { ownedDecks: ['mega-gengar'] });
  vi.spyOn(Math, 'random').mockReturnValue(0.999); // the last deck in the pool
  fireEvent.click(screen.getByRole('button', { name: 'Play' }));
  expect(useGame.getState().config?.botDeck).toBe(DECKS.at(-1)!.list);
});

test('the default deck falls back to the first owned deck when the saved starter is not owned', async () => {
  await launch('duel', { starterDeck: 'mega-lucario', ownedDecks: ['mega-diancie'] });
  expect(within(yours()).getByRole('button', { name: /Mega Diancie ex/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('Gym match setup lists only owned decks', async () => {
  await launch('gym', { ownedDecks: ['mega-gengar'] });
  fireEvent.click(screen.getByRole('button', { name: 'Challenge Brock' }));
  expect(names(yours())).toEqual(['Mega Gengar ex']);
});

test('an Elite Four run in progress keeps its locked deck even if it is not owned', async () => {
  await launch('gym', {
    ownedDecks: ['mega-gengar'],
    gym: {
      badges: LEADERS.map((l) => l.id),
      hallOfFame: [],
      run: {
        stage: 0,
        deck: { kind: 'theme', id: theme.id, name: theme.name, cover: theme.cover, cards: theme.list.cards },
      },
    },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Continue run' }));
  expect(screen.getByText(`${theme.name} (locked for this run)`)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Battle!' }));
  await waitFor(() => expect(useGame.getState().config?.humanDeck.cards).toEqual(theme.list.cards));
});
