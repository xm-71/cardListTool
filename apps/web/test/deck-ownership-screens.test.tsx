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

/** The "Your deck" panel on a setup screen. */
const panel = () => within(screen.getByRole('heading', { name: 'Your deck' }).parentElement!);

beforeEach(() => useSettings.getState().setSound(false));
afterEach(() => vi.restoreAllMocks());

test('Duel shows the starter as the deck and no deck tiles', async () => {
  await launch('duel', { ownedDecks: ['mega-gengar'] });
  expect(panel().getByText('Mega Gengar ex')).toBeInTheDocument();
  expect(screen.queryByRole('group', { name: 'Theme decks' })).toBeNull();
});

test('Duel shows a bought deck when it is the active deck', async () => {
  await launch('duel', { ownedDecks: ['mega-gengar', theme.id], activeDeck: theme.id });
  expect(panel().getByText(theme.name)).toBeInTheDocument();
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

test('the deck falls back to the first owned deck when the saved starter is not owned', async () => {
  await launch('duel', { starterDeck: 'mega-lucario', ownedDecks: ['mega-diancie'] });
  expect(panel().getByText('Mega Diancie ex')).toBeInTheDocument();
});

test('Gym match setup shows the active owned deck', async () => {
  await launch('gym', { ownedDecks: ['mega-gengar'] });
  fireEvent.click(screen.getByRole('button', { name: 'Challenge Brock' }));
  expect(panel().getByText('Mega Gengar ex')).toBeInTheDocument();
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
