import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { GYM_DECKS } from '@ptcg/cards';
import { beforeEach, expect, test } from 'vitest';
import { App } from '../src/App.tsx';
import { emptyGym, type GymProgress } from '../src/game/gym.ts';
import { useGame } from '../src/game/store.ts';
import { useNav } from '../src/nav/useNav.ts';
import { createMemoryStore } from '../src/profile/memoryStore.ts';
import { newProfile, type Profile } from '../src/profile/types.ts';
import { useProfile } from '../src/profile/useProfile.ts';
import { useSettings } from '../src/settings/useSettings.ts';

const never = { choose: () => new Promise<never>(() => {}) };
const entry = { date: '2026-10-13', playerName: 'ASH', deckName: 'Deck', cover: 'me01-077' };
const champion: GymProgress = { ...emptyGym(), hallOfFame: [entry] };

async function launch(profile: Partial<Profile> = {}) {
  useGame.getState().reset();
  useProfile.getState().reset();
  useNav.setState({ route: 'gym', returnTo: null });
  await act(() =>
    useProfile
      .getState()
      .init(createMemoryStore({ ...newProfile(), introDone: true, playerName: 'ASH', ...profile }), true),
  );
  render(<App botClient={never} botDelayMs={0} />);
}

const johtoTab = () => fireEvent.click(screen.getByRole('tab', { name: 'Johto' }));
const johtoCase = () => screen.getByRole('list', { name: 'Johto badge case' });

beforeEach(() => useSettings.getState().setSound(false));

test('Gym Challenge has Kanto and Johto tabs, Kanto first and unchanged', async () => {
  await launch();
  expect(screen.getByRole('tab', { name: 'Kanto' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('tab', { name: 'Johto' })).toHaveAttribute('aria-selected', 'false');
  expect(screen.getByRole('list', { name: 'Badge case' })).toBeInTheDocument();
  expect(screen.getByText('Elite Four')).toBeInTheDocument();
  expect(screen.getByText('Hall of Fame')).toBeInTheDocument();
});

test('Johto is locked until the Kanto Champion has been beaten', async () => {
  await launch();
  johtoTab();
  expect(screen.getByText('Beat the Kanto Champion to travel to Johto.')).toBeInTheDocument();
  expect(screen.queryByRole('list', { name: 'Johto badge case' })).toBeNull();
});

test('with a Hall of Fame entry the Johto tab shows the badge case with all eight leaders', async () => {
  await launch({ gym: champion });
  johtoTab();
  expect(screen.getByText(/Badges: 0 \/ 8/)).toBeInTheDocument();
  const tiles = within(johtoCase()).getAllByRole('listitem');
  expect(tiles.map((t) => t.getAttribute('aria-label'))).toEqual([
    'Falkner',
    'Bugsy',
    'Whitney',
    'Morty',
    'Chuck',
    'Jasmine',
    'Pryce',
    'Clair',
  ]);
  expect(screen.queryByText('Coming soon')).toBeNull();
  expect(screen.queryByText(/More leaders/)).toBeNull();
  expect(screen.getByRole('button', { name: 'Challenge Falkner' })).toBeEnabled();
  expect(
    within(screen.getByRole('listitem', { name: 'Falkner' })).getByText(/150 credits/),
  ).toBeInTheDocument();
  expect(
    within(screen.getByRole('listitem', { name: 'Falkner' })).getByText(/Mega Evolution pack/),
  ).toBeInTheDocument();
  // The later leaders wait for the earlier ones.
  const bugsy = within(screen.getByRole('listitem', { name: 'Bugsy' })).getByRole('button');
  expect(bugsy).toBeDisabled();
});

test('beating Falkner opens Bugsy with the 175 credit reward', async () => {
  await launch({ gym: { ...champion, badges: ['falkner'] } });
  johtoTab();
  expect(screen.getByText(/Badges: 1 \/ 8/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Rematch Falkner' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Challenge Bugsy' })).toBeEnabled();
  expect(
    within(screen.getByRole('listitem', { name: 'Bugsy' })).getByText(/175 credits/),
  ).toBeInTheDocument();
});

test('Challenge Falkner then Battle! starts a Medium-bot game against his deck; Whitney is a Hard bot', async () => {
  await launch({ gym: { ...champion, badges: ['falkner', 'bugsy'] } });
  johtoTab();
  fireEvent.click(screen.getByRole('button', { name: 'Rematch Falkner' }));
  expect(screen.getByText(/Falkner's Gym/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Battle!' }));
  expect(useGame.getState().config).toMatchObject({
    mode: 'bot',
    difficulty: 'medium',
    botDeck: GYM_DECKS.falkner,
    context: { kind: 'gym', leaderId: 'falkner' },
  });
});

test('Chuck waits for Morty, then pays 250 credits', async () => {
  await launch({ gym: { ...champion, badges: ['falkner', 'bugsy', 'whitney'] } });
  johtoTab();
  expect(within(screen.getByRole('listitem', { name: 'Chuck' })).getByRole('button')).toBeDisabled();
  cleanup();
  await launch({ gym: { ...champion, badges: ['falkner', 'bugsy', 'whitney', 'morty'] } });
  johtoTab();
  expect(screen.getByRole('button', { name: 'Challenge Chuck' })).toBeEnabled();
  expect(
    within(screen.getByRole('listitem', { name: 'Chuck' })).getByText(/250 credits/),
  ).toBeInTheDocument();
});

test('Clair is fought with the Hard bot and her own deck', async () => {
  const badges = ['falkner', 'bugsy', 'whitney', 'morty', 'chuck', 'jasmine', 'pryce'];
  await launch({ gym: { ...champion, badges } });
  johtoTab();
  expect(screen.getByText(/Badges: 7 \/ 8/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Challenge Clair' }));
  fireEvent.click(screen.getByRole('button', { name: 'Battle!' }));
  expect(useGame.getState().config).toMatchObject({ difficulty: 'hard', botDeck: GYM_DECKS.clair });
});

test('Whitney is fought with the Hard bot', async () => {
  await launch({ gym: { ...champion, badges: ['falkner', 'bugsy'] } });
  johtoTab();
  fireEvent.click(screen.getByRole('button', { name: 'Challenge Whitney' }));
  fireEvent.click(screen.getByRole('button', { name: 'Battle!' }));
  expect(useGame.getState().config).toMatchObject({ difficulty: 'hard', botDeck: GYM_DECKS.whitney });
});

test('the Elite Four and Hall of Fame panels belong to the Kanto tab', async () => {
  await launch({ gym: champion });
  johtoTab();
  expect(screen.queryByText('Elite Four')).toBeNull();
  expect(screen.queryByText('Hall of Fame')).toBeNull();
  fireEvent.click(screen.getByRole('tab', { name: 'Kanto' }));
  expect(screen.getByText('Elite Four')).toBeInTheDocument();
});

test('Back from the Deck Case returns to the same Johto leader and tab', async () => {
  await launch({ gym: champion });
  johtoTab();
  fireEvent.click(screen.getByRole('button', { name: 'Challenge Falkner' }));
  fireEvent.click(screen.getByRole('button', { name: 'Change' }));
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByText(/Falkner's Gym/)).toBeInTheDocument();
  // The setup screen has its own Back button (after the frame's) that returns to the badge case.
  fireEvent.click(screen.getAllByRole('button', { name: 'Back' }).at(-1)!);
  expect(screen.getByRole('tab', { name: 'Johto' })).toHaveAttribute('aria-selected', 'true');
});

test('Collector mode closes Gym Challenge', async () => {
  await launch({ collectorMode: true, gym: champion });
  expect(useNav.getState().route).toBe('menu');
});
