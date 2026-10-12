import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { App } from '../src/App.tsx';
import { DECKS } from '../src/game/catalog.ts';
import {
  chooseStarter,
  newRun,
  skipOffer,
  recordResult,
  beginFight,
  type FrontierRun,
} from '../src/game/frontier/run.ts';
import { useGame } from '../src/game/store.ts';
import { useNav, type Route } from '../src/nav/useNav.ts';
import { createMemoryStore } from '../src/profile/memoryStore.ts';
import { newProfile, type Profile } from '../src/profile/types.ts';
import { useProfile } from '../src/profile/useProfile.ts';
import { useSettings } from '../src/settings/useSettings.ts';

const never = { choose: () => new Promise<never>(() => {}) };
const hub = (wins = 0): FrontierRun => {
  let r = chooseStarter(newRun(21), newRun(21).starterChoices[0]!);
  for (let i = 0; i < wins; i++) r = skipOffer(recordResult(beginFight(r), 'win'));
  return r;
};
const run = () => useProfile.getState().profile.frontier.run;

async function launch(route: Route, profile: Partial<Profile> = {}) {
  useGame.getState().reset();
  useProfile.getState().reset();
  useNav.setState({ route });
  await useProfile
    .getState()
    .init(createMemoryStore({ ...newProfile(), introDone: true, playerName: 'ASH', ...profile }), true);
  render(<App botClient={never} botDelayMs={0} />);
}

beforeEach(() => useSettings.getState().setSound(false));

test('the main menu has Battle Frontier after Gym Challenge', async () => {
  await launch('menu');
  const items = within(screen.getByRole('menu', { name: 'Main menu' })).getAllByRole('menuitem');
  const labels = items.map((i) => i.textContent?.replace('▶', '').trim());
  expect(labels.slice(0, 3)).toEqual(['Duel', 'Gym Challenge', 'Battle Frontier']);
  fireEvent.click(items[2]!);
  expect(await screen.findByRole('button', { name: 'Start run' })).toBeInTheDocument();
});

test('Collector mode hides Battle Frontier and sends the route back to the menu', async () => {
  await launch('frontier', { collectorMode: true });
  await waitFor(() => expect(screen.getByRole('menu', { name: 'Main menu' })).toBeInTheDocument());
  expect(screen.queryByRole('button', { name: 'Start run' })).toBeNull();
  const collector = within(screen.getByRole('menu', { name: 'Main menu' }))
    .getAllByRole('menuitem')
    .map((i) => i.textContent);
  expect(collector.join()).not.toMatch(/Frontier/);
});

test('with no run, the screen offers Start run; starting shows the 3 starter deck tiles', async () => {
  await launch('frontier');
  fireEvent.click(await screen.findByRole('button', { name: 'Start run' }));
  const tiles = await screen.findByRole('list', { name: 'Starter decks' });
  const starters = DECKS.filter((d) => d.kind === 'starter');
  expect(within(tiles).getAllByRole('button')).toHaveLength(3);
  for (const d of starters)
    expect(within(tiles).getByRole('button', { name: `Pick ${d.name}` })).toBeInTheDocument();
});

test('picking a starter shows the hub: lives, the 1-8 fight track with a boss mark, the next opponent card (name, type, cover, difficulty), View deck, Fight, Abandon run', async () => {
  await launch('frontier', { frontier: { run: newRun(21), hallOfFame: [] } });
  const pick = within(await screen.findByRole('list', { name: 'Starter decks' })).getAllByRole('button')[0]!;
  fireEvent.click(pick);
  expect(await screen.findByText('Lives: 2')).toBeInTheDocument();
  const track = screen.getByRole('list', { name: 'Fight track' });
  const steps = within(track).getAllByRole('listitem');
  expect(steps).toHaveLength(8);
  expect(steps[0]).toHaveAttribute('aria-current', 'step');
  expect(steps[7]).toHaveTextContent(/Boss/);
  const next = run()!.opponents[0]!;
  const card = screen.getByRole('region', { name: 'Next opponent' });
  expect(within(card).getByText(next.name)).toBeInTheDocument();
  expect(within(card).getByText(new RegExp(next.type))).toBeInTheDocument();
  expect(within(card).getByText(/Easy bot/)).toBeInTheDocument();
  expect(within(card).getByRole('img', { name: next.name })).toBeInTheDocument();
  for (const name of ['View deck', 'Fight', 'Abandon run'])
    expect(screen.getByRole('button', { name })).toBeInTheDocument();
});

test('the boss card names the Frontier Brain', async () => {
  await launch('frontier', { frontier: { run: hub(7), hallOfFame: [] } });
  const card = await screen.findByRole('region', { name: 'Next opponent' });
  expect(within(card).getByText(`Frontier Brain ${run()!.opponents[7]!.brain!}`)).toBeInTheDocument();
  expect(within(card).getByText(/Hard bot/)).toBeInTheDocument();
});

test('View deck lists the run deck grouped as Pokémon, Trainers and Energy with counts, 60 in total', async () => {
  await launch('frontier', { frontier: { run: hub(), hallOfFame: [] } });
  fireEvent.click(await screen.findByRole('button', { name: 'View deck' }));
  const view = screen.getByRole('region', { name: 'Run deck' });
  for (const g of ['Pokémon', 'Trainers', 'Energy'])
    expect(within(view).getByRole('heading', { name: new RegExp(`^${g}`) })).toBeInTheDocument();
  const counts = within(view)
    .getAllByTestId('deck-count')
    .map((e) => Number(e.textContent!.replace('×', '')));
  expect(counts.reduce((a, b) => a + b, 0)).toBe(60);
});

test('Abandon run asks to confirm', async () => {
  await launch('frontier', { frontier: { run: hub(2), hallOfFame: [] } });
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  fireEvent.click(await screen.findByRole('button', { name: 'Abandon run' }));
  expect(confirm).toHaveBeenCalled();
  expect(run()!.phase).toBe('hub');
  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: 'Abandon run' }));
  await waitFor(() => expect(run()!.phase).toBe('over'));
});

test('Fight starts the match', async () => {
  await launch('frontier', { frontier: { run: hub(1), hallOfFame: [] } });
  fireEvent.click(await screen.findByRole('button', { name: 'Fight' }));
  await waitFor(() =>
    expect(useGame.getState().config?.context).toMatchObject({ kind: 'frontier', fight: 1 }),
  );
  expect(run()!.inMatch).toBe(true);
});

test('a run saved with inMatch is settled as a loss when the screen opens', async () => {
  await act(() =>
    launch('frontier', { frontier: { run: { ...hub(3), inMatch: true, matchSeed: 9 }, hallOfFame: [] } }),
  );
  await waitFor(() => expect(run()!.lives).toBe(1));
  expect(run()).toMatchObject({ phase: 'hub', fight: 3 });
  expect(await screen.findByText('Lives: 1')).toBeInTheDocument();
});
