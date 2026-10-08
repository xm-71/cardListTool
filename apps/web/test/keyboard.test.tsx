import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test } from 'vitest';
import { setCards } from '@ptcg/cards';
import { App } from '../src/App.tsx';
import { useGame } from '../src/game/store.ts';
import { useNav } from '../src/nav/useNav.ts';
import { createMemoryStore } from '../src/profile/memoryStore.ts';
import { newProfile, type Profile } from '../src/profile/types.ts';
import { useProfile } from '../src/profile/useProfile.ts';
import { useSettings } from '../src/settings/useSettings.ts';
import { PackOpening } from '../src/ui/PackOpening.tsx';

const never = { choose: () => new Promise<never>(() => {}) };

async function launch(profile: Partial<Profile> = {}) {
  useGame.getState().reset();
  useProfile.getState().reset();
  useNav.setState({ route: 'title' });
  await useProfile.getState().init(createMemoryStore({ ...newProfile(), ...profile }), true);
  render(<App botClient={never} botDelayMs={0} />);
}

beforeEach(() => useSettings.getState().setSound(false));

test('Enter on the title opens the intro with an empty name field (it does not submit it)', async () => {
  const user = userEvent.setup();
  await launch();
  await user.keyboard('{Enter}');
  const input = await screen.findByLabelText('Your name');
  expect(input).toHaveValue('');
});

test('a letter key on the title does not end up in the name field', async () => {
  const user = userEvent.setup();
  await launch();
  await user.keyboard('a');
  expect(await screen.findByLabelText('Your name')).toHaveValue('');
});

test('the main menu has keyboard focus when it appears', async () => {
  const user = userEvent.setup();
  await launch({ introDone: true });
  await user.keyboard('{Enter}');
  await screen.findByRole('menu', { name: 'Main menu' });
  await user.keyboard('{ArrowDown}{Enter}');
  expect(useNav.getState().route).toBe('shop');
});

test('Enter flips cards in the pack opening without clicking first', async () => {
  const user = userEvent.setup();
  const ids = setCards('me01')
    .slice(0, 10)
    .map((c) => c.id);
  render(<PackOpening setId="me01" cards={ids} onDone={() => {}} />);
  await screen.findByText('Card 0 of 10', {}, { timeout: 3000 });
  await user.keyboard('{Enter}');
  expect(screen.getByText('Card 1 of 10')).toBeInTheDocument();
});

test('Skip keeps a name already typed in the intro', async () => {
  const user = userEvent.setup();
  await launch();
  await user.keyboard('{Enter}');
  await user.type(await screen.findByLabelText('Your name'), 'ASH');
  await user.click(screen.getByRole('button', { name: 'OK' }));
  await user.click(screen.getByRole('button', { name: 'Skip' }));
  await waitFor(() => expect(useProfile.getState().profile.introDone).toBe(true));
  expect(useProfile.getState().profile.playerName).toBe('ASH');
});

test('Replay intro then Skip keeps the existing name and starter deck', async () => {
  await launch({ introDone: true, playerName: 'KAI', starterDeck: 'mega-lucario' });
  await act(() => useProfile.getState().replayIntro());
  act(() => useNav.getState().go('intro'));
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Skip' }));
  await waitFor(() => expect(useProfile.getState().profile.introDone).toBe(true));
  expect(useProfile.getState().profile).toMatchObject({ playerName: 'KAI', starterDeck: 'mega-lucario' });
});

test('the intro offers only the 3 starter decks, not the theme decks', async () => {
  const user = userEvent.setup();
  await launch();
  await user.keyboard('{Enter}');
  await user.type(await screen.findByLabelText('Your name'), 'ASH{Enter}');
  await screen.findByRole('button', { name: /Mega Gengar ex/ });
  expect(screen.getAllByRole('button', { name: /^Mega .* ex$/ })).toHaveLength(3);
  expect(screen.queryByRole('button', { name: /Mega Venusaur ex/ })).toBeNull();
});
