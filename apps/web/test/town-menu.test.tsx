import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, expect, test } from 'vitest';
import { App } from '../src/App.tsx';
import { beginFight, chooseStarter, newRun, recordResult, skipOffer } from '../src/game/frontier/run.ts';
import { useGame } from '../src/game/store.ts';
import { useNav } from '../src/nav/useNav.ts';
import { createMemoryStore } from '../src/profile/memoryStore.ts';
import { newProfile, type Profile } from '../src/profile/types.ts';
import { useProfile } from '../src/profile/useProfile.ts';
import { useSettings } from '../src/settings/useSettings.ts';

const never = { choose: () => new Promise<never>(() => {}) };

async function launch(profile: Partial<Profile> = {}) {
  useGame.getState().reset();
  useProfile.getState().reset();
  useNav.setState({ route: 'menu' });
  await act(() =>
    useProfile.getState().init(
      createMemoryStore({
        ...newProfile(),
        introDone: true,
        playerName: 'ASH',
        starterDeck: 'mega-gengar',
        // Already owned, so its cards aren't added on top of the collection a test sets.
        ownedDecks: ['mega-gengar'],
        ...profile,
      }),
      true,
    ),
  );
  render(<App botClient={never} botDelayMs={0} />);
}

const menu = () => screen.getByRole('menu', { name: 'Main menu' });
const item = (name: string) => within(menu()).getByRole('menuitem', { name });
const active = () =>
  within(menu())
    .getAllByRole('menuitem')
    .find((i) => i.dataset.active === 'true');
const frontierAfter = (wins: number) => {
  let r = chooseStarter(newRun(5), newRun(5).starterChoices[0]!);
  for (let i = 0; i < wins; i++) r = skipOffer(recordResult(beginFight(r), 'win'));
  return { run: r, hallOfFame: [] };
};

beforeEach(() => useSettings.getState().setSound(false));

test('the main menu is a town square: eight buildings around a fountain, Duel Hall selected', async () => {
  await launch();
  const items = within(menu()).getAllByRole('menuitem');
  expect(items.map((i) => i.getAttribute('aria-label'))).toEqual([
    'Duel',
    'Gym Challenge',
    'Battle Frontier',
    'Shop',
    'Binder',
    'Decks',
    'Options',
    'My House',
  ]);
  expect(menu()).toHaveFocus();
  expect(active()).toBe(item('Duel'));
  expect(item('Shop')).toHaveTextContent(/Poké Mart/i);
  expect(screen.getByTestId('town-dialog')).toHaveTextContent('One game against a bot.');
});

test('arrow keys walk around the square and the dialog box follows; Enter goes in', async () => {
  await launch({ credits: 1240 });
  fireEvent.keyDown(menu(), { key: 'ArrowLeft' }); // across the fountain to the Mart
  expect(active()).toBe(item('Shop'));
  expect(screen.getByTestId('town-dialog')).toHaveTextContent('Packs cost 150 credits. You have 1,240.');
  fireEvent.keyDown(menu(), { key: 'ArrowUp' });
  expect(active()).toBe(item('My House'));
  fireEvent.keyDown(menu(), { key: 'ArrowRight' });
  expect(active()).toBe(item('Gym Challenge'));
  fireEvent.keyDown(menu(), { key: 'Enter' });
  expect(useNav.getState().route).toBe('gym');
});

test('a click goes straight in', async () => {
  await launch();
  fireEvent.click(item('Binder'));
  expect(useNav.getState().route).toBe('binder');
});

test('on a touch screen the first tap selects and describes, the second goes in', async () => {
  await launch();
  const gym = item('Gym Challenge');
  fireEvent.pointerDown(gym, { pointerType: 'touch' });
  fireEvent.click(gym);
  expect(useNav.getState().route).toBe('menu');
  expect(active()).toBe(gym);
  expect(screen.getByTestId('town-dialog')).toHaveTextContent('0 of 8 badges. Next up: Brock');
  fireEvent.pointerDown(gym, { pointerType: 'touch' });
  fireEvent.click(gym);
  expect(useNav.getState().route).toBe('gym');
});

test('the buildings show progress: badges on the Gym flag, lit Frontier floors, the NEW sign, the binder count', async () => {
  await launch({
    gym: { badges: ['brock', 'misty', 'surge'], run: null, hallOfFame: [] },
    frontier: frontierAfter(2),
    credits: 400,
    collection: { 'me01-001': 1, 'me01-002': 3 },
  });
  expect(within(item('Gym Challenge')).getByText('3/8')).toBeInTheDocument();
  const floors = within(item('Battle Frontier')).getAllByTestId('floor');
  expect(floors).toHaveLength(8);
  expect(floors.filter((f) => f.dataset.lit === 'true')).toHaveLength(2);
  expect(within(item('Shop')).getByText('NEW')).toBeInTheDocument();
  expect(within(item('Binder')).getByText('2')).toBeInTheDocument();
});

test('a new player sees no flag count above zero, dark floors and, without credits, no NEW sign', async () => {
  await launch({ credits: 10 });
  expect(within(item('Gym Challenge')).getByText('0/8')).toBeInTheDocument();
  expect(
    within(item('Battle Frontier'))
      .getAllByTestId('floor')
      .some((f) => f.dataset.lit === 'true'),
  ).toBe(false);
  expect(within(item('Shop')).queryByText('NEW')).toBeNull();
});

test('Collector mode closes the battle buildings: they stay on the map, signed CLOSED, and cannot be entered', async () => {
  await launch({ collectorMode: true });
  for (const name of ['Duel', 'Gym Challenge', 'Battle Frontier', 'Decks']) {
    expect(item(name)).toBeDisabled();
    expect(within(item(name)).getByText('CLOSED')).toBeInTheDocument();
  }
  for (const name of ['Shop', 'Binder', 'Options', 'My House']) expect(item(name)).toBeEnabled();
  expect(active()).toBe(item('Shop'));
  fireEvent.keyDown(menu(), { key: 'ArrowRight' }); // Duel Hall is closed: stay at the Mart
  expect(active()).toBe(item('Shop'));
});

test('My House opens the Trainer Card with name, credits, deck, badges and the Frontier run', async () => {
  await launch({
    credits: 1240,
    gym: { badges: ['brock', 'misty', 'surge'], run: null, hallOfFame: [] },
    frontier: frontierAfter(2),
  });
  fireEvent.click(item('My House'));
  const card = screen.getByRole('dialog', { name: 'Trainer Card' });
  expect(within(card).getByText('ASH')).toBeInTheDocument();
  expect(within(card).getByText(/1,240/)).toBeInTheDocument();
  expect(within(card).getByText('Mega Gengar ex')).toBeInTheDocument();
  expect(within(card).getByText(/Badges 3 \/ 8/)).toBeInTheDocument();
  expect(within(card).getByText(/Fight 3 of 8/)).toBeInTheDocument();
  fireEvent.click(within(card).getByRole('button', { name: 'Battle Frontier' }));
  expect(useNav.getState().route).toBe('frontier');
});

test('the Trainer Card shows an owned deck even when the saved default is not owned', async () => {
  await launch({ starterDeck: 'mega-lucario', ownedDecks: ['mega-diancie'] });
  fireEvent.click(item('My House'));
  const card = screen.getByRole('dialog', { name: 'Trainer Card' });
  expect(within(card).getByText('Mega Diancie ex')).toBeInTheDocument();
  expect(within(card).queryByText('Mega Lucario ex')).toBeNull();
});

test('the Trainer Card closes with Escape and gives the town its keys back', async () => {
  await launch();
  fireEvent.keyDown(menu(), { key: 'ArrowUp' }); // Duel Hall → Frontier
  fireEvent.keyDown(menu(), { key: 'ArrowLeft' });
  fireEvent.keyDown(menu(), { key: 'ArrowLeft' });
  expect(active()).toBe(item('My House'));
  fireEvent.keyDown(menu(), { key: 'Enter' });
  const card = screen.getByRole('dialog', { name: 'Trainer Card' });
  // Focus moves into the card, and the town ignores keys while it is open.
  expect(card.contains(document.activeElement)).toBe(true);
  fireEvent.keyDown(menu(), { key: 'ArrowRight' });
  expect(active()).toBe(item('My House'));
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
  expect(screen.queryByRole('dialog', { name: 'Trainer Card' })).toBeNull();
  expect(useNav.getState().route).toBe('menu');
  expect(menu()).toHaveFocus();
  fireEvent.keyDown(menu(), { key: 'ArrowRight' });
  expect(active()).toBe(item('Gym Challenge'));
});

test('a mouse hover selects a building; a finger or pen passing over does not', async () => {
  await launch();
  fireEvent.pointerEnter(item('Options'), { pointerType: 'touch' });
  expect(active()).toBe(item('Duel'));
  fireEvent.pointerEnter(item('Options'), { pointerType: 'mouse' });
  expect(active()).toBe(item('Options'));
});

test('a pen tap previews first, like a finger', async () => {
  await launch();
  fireEvent.pointerDown(item('Binder'), { pointerType: 'pen' });
  fireEvent.click(item('Binder'));
  expect(useNav.getState().route).toBe('menu');
  expect(active()).toBe(item('Binder'));
});

test('in Collector mode the Trainer Card has no battle buttons', async () => {
  await launch({ collectorMode: true });
  fireEvent.click(item('My House'));
  const card = screen.getByRole('dialog', { name: 'Trainer Card' });
  expect(within(card).queryByRole('button', { name: 'Battle Frontier' })).toBeNull();
  expect(within(card).queryByRole('button', { name: 'Gym Challenge' })).toBeNull();
});
