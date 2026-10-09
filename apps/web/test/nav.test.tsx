import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, test } from 'vitest';
import { App } from '../src/App.tsx';
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
  useNav.setState({ route: 'title' });
  await useProfile.getState().init(createMemoryStore({ ...newProfile(), ...profile }), true);
  render(<App botClient={never} botDelayMs={0} />);
}

/** Click a dialogue box until its text is complete, then once more to advance. */
function advance(text: string) {
  const box = screen.getByRole('button', { name: text });
  fireEvent.click(box);
  fireEvent.click(box);
}

beforeEach(() => useSettings.getState().setSound(false));

test('first launch: PRESS START leads to the intro, which ends in the main menu', async () => {
  await launch();
  expect(screen.getByRole('heading', { name: /Pokémon Trading Card Game/i })).toBeInTheDocument();
  fireEvent.keyDown(window, { key: 'Enter' });
  fireEvent.change(await screen.findByLabelText('Your name'), { target: { value: 'ALEX' } });
  fireEvent.click(screen.getByRole('button', { name: 'OK' }));
  fireEvent.click(screen.getByRole('button', { name: /Mega Lucario ex/ }));
  advance('Beat the bots to earn credits!');
  advance('Spend credits on booster packs in the SHOP.');
  advance('Build your own decks in DECKS from cards the game can play.');
  expect(await screen.findByRole('menu', { name: 'Main menu' })).toBeInTheDocument();
  expect(screen.getByRole('banner')).toHaveTextContent('ALEX');
  expect(useProfile.getState().profile).toMatchObject({
    playerName: 'ALEX',
    starterDeck: 'mega-lucario',
    introDone: true,
  });
  fireEvent.click(screen.getByRole('menuitem', { name: 'Duel' }));
  const yours = screen.getByRole('group', { name: 'Your deck' });
  expect(within(yours).getByRole('button', { name: /Mega Lucario ex/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('a returning player goes straight from the title to the menu', async () => {
  await launch({ introDone: true, playerName: 'SAM' });
  fireEvent.click(screen.getByRole('heading', { name: /Pokémon Trading Card Game/i }));
  expect(screen.getByRole('menu', { name: 'Main menu' })).toBeInTheDocument();
});

test('Skip finishes the intro with the defaults', async () => {
  await launch();
  fireEvent.keyDown(window, { key: ' ' });
  fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
  await screen.findByRole('menu', { name: 'Main menu' });
  expect(useProfile.getState().profile).toMatchObject({
    playerName: 'PLAYER',
    starterDeck: 'mega-gengar',
    introDone: true,
  });
});

test('the menu works from the keyboard and Back returns to it', async () => {
  await launch({ introDone: true });
  fireEvent.keyDown(window, { key: 'Enter' });
  const menu = screen.getByRole('menu', { name: 'Main menu' });
  fireEvent.keyDown(menu, { key: 'ArrowDown' }); // Gym Challenge
  fireEvent.keyDown(menu, { key: 'ArrowDown' }); // Shop
  fireEvent.keyDown(menu, { key: 'Enter' });
  expect(screen.getAllByRole('button', { name: 'Buy & open' })).toHaveLength(11);
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByRole('menu', { name: 'Main menu' })).toBeInTheDocument();
});

test('Options toggles sound, renames, and replays the intro', async () => {
  useSettings.getState().setSound(true);
  await launch({ introDone: true, playerName: 'SAM' });
  fireEvent.keyDown(window, { key: 'Enter' });
  fireEvent.click(screen.getByRole('menuitem', { name: 'Options' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Sound' }));
  expect(useSettings.getState().sound).toBe(false);
  fireEvent.change(screen.getByLabelText('Change name'), { target: { value: 'KAI' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
  await waitFor(() => expect(useProfile.getState().profile.playerName).toBe('KAI'));
  fireEvent.click(screen.getByRole('button', { name: 'Replay intro' }));
  expect(await screen.findByLabelText('Your name')).toBeInTheDocument();
});

test('(RF3) typing in the intro name field stays in the intro; keys after the title do nothing', async () => {
  await launch();
  fireEvent.keyDown(window, { key: 'Enter' });
  const input = await screen.findByLabelText('Your name');
  for (const key of ['a', 'Enter', ' ']) fireEvent.keyDown(input, { key });
  expect(screen.getByLabelText('Your name')).toBeInTheDocument();
  fireEvent.keyDown(window, { key: 'Enter' });
  expect(screen.getByLabelText('Your name')).toBeInTheDocument();
  expect(useNav.getState().route).toBe('intro');
});

test('the title waits for the profile before continuing', async () => {
  useProfile.getState().reset();
  useNav.setState({ route: 'title' });
  render(<App botClient={never} botDelayMs={0} />);
  act(() => {
    fireEvent.keyDown(window, { key: 'Enter' });
  });
  // still on the title until the (memory fallback) profile has loaded
  await waitFor(() => expect(useProfile.getState().ready).toBe(true));
  fireEvent.keyDown(window, { key: 'Enter' });
  expect(useNav.getState().route).not.toBe('title');
});

test('Quit to home from a game lands on the main menu', async () => {
  useGame.getState().reset();
  useProfile.getState().reset();
  await useProfile.getState().init(createMemoryStore({ ...newProfile(), introDone: true }), true);
  render(<App botClient={never} botDelayMs={0} startAt="duel" />);
  fireEvent.click(screen.getByRole('button', { name: 'Play' }));
  const confirm = window.confirm;
  window.confirm = () => true;
  fireEvent.click(screen.getByRole('button', { name: 'Quit to home' }));
  window.confirm = confirm;
  expect(screen.getByRole('menu', { name: 'Main menu' })).toBeInTheDocument();
});
