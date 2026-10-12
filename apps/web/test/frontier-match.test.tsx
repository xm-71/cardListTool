import { act, render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { App } from '../src/App.tsx';
import { gameAward } from '../src/game/awards.ts';
import { opponentName } from '../src/game/describe.ts';
import { startFrontierMatch } from '../src/game/frontierMatch.ts';
import { opponentDeck } from '../src/game/frontier/opponents.ts';
import { chooseStarter, newRun, type FrontierRun } from '../src/game/frontier/run.ts';
import { useGame } from '../src/game/store.ts';
import { useNav } from '../src/nav/useNav.ts';
import { createMemoryStore } from '../src/profile/memoryStore.ts';
import { newProfile, type Profile } from '../src/profile/types.ts';
import { useProfile } from '../src/profile/useProfile.ts';
import { useSettings } from '../src/settings/useSettings.ts';

const never = { choose: () => new Promise<never>(() => {}) };
const hubRun = (): FrontierRun => chooseStarter(newRun(11), newRun(11).starterChoices[0]!);
const run = () => useProfile.getState().profile.frontier.run!;

async function launch(profile: Partial<Profile> = {}) {
  useGame.getState().reset();
  useProfile.getState().reset();
  useNav.setState({ route: 'frontier' });
  await useProfile.getState().init(
    createMemoryStore({
      ...newProfile(),
      introDone: true,
      playerName: 'ASH',
      credits: 0,
      frontier: { run: hubRun(), hallOfFame: [] },
      ...profile,
    }),
    true,
  );
  render(<App botClient={never} botDelayMs={0} />);
}

beforeEach(() => useSettings.getState().setSound(false));

test("startFrontierMatch starts a bot game with the run deck, the opponent deck and the band's difficulty", async () => {
  await launch();
  await act(() => startFrontierMatch());
  const { config } = useGame.getState();
  const r = run();
  expect(config).toMatchObject({ mode: 'bot', difficulty: 'easy' });
  expect(config!.humanDeck.cards).toEqual(r.deck);
  expect(config!.botDeck).toEqual(opponentDeck(r.opponents[0]!));
  expect(config!.context).toEqual({ kind: 'frontier', fight: 0, opponent: r.opponents[0]!.name });
  // The run remembers which game is being played.
  expect(r).toMatchObject({ inMatch: true, matchSeed: config!.seed });
});

test("opponentName returns the context's opponent for a frontier game", () => {
  expect(opponentName({ mode: 'bot', context: { kind: 'frontier', fight: 7, opponent: 'Vesper' } }, 0)).toBe(
    'Vesper',
  );
});

test('a finished frontier game calls recordFrontier once with its fight, won and draw', async () => {
  await launch();
  const record = vi.spyOn(useProfile.getState(), 'recordFrontier');
  await act(() => startFrontierMatch());
  const seed = useGame.getState().config!.seed;
  act(() => useGame.getState().dispatch(1, { type: 'concede' })); // the bot gives up: a win
  await waitFor(() => expect(run().phase).toBe('reward'));
  expect(record).toHaveBeenCalledTimes(1);
  expect(record).toHaveBeenCalledWith({ seed, fight: 0, won: true, draw: false });
  expect(run().wins).toBe(1);
});

test('a finished frontier game shows the Frontier panel, not the Gym game-over screen', async () => {
  await launch();
  await act(() => startFrontierMatch());
  act(() => useGame.getState().dispatch(1, { type: 'concede' }));
  const over = await screen.findByRole('dialog', { name: 'Game over' });
  expect(within(over).getByRole('button', { name: 'Continue' })).toBeInTheDocument();
  expect(within(over).queryByText(/Badge/)).toBeNull();
});

test('quitting a frontier match counts as a loss (concede) and the result goes to recordFrontier', async () => {
  await launch();
  await act(() => startFrontierMatch());
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  fireEvent.click(await screen.findByRole('button', { name: 'Quit to home' }));
  await screen.findByRole('dialog', { name: 'Game over' });
  await waitFor(() => expect(run().lives).toBe(1));
  expect(run()).toMatchObject({ phase: 'hub', fight: 0 });
});

test('no normal Duel credits are paid for a frontier game', async () => {
  await launch();
  await act(() => startFrontierMatch());
  const config = useGame.getState().config!;
  expect(gameAward(config, { winner: 0, reason: 'prizes' }, 0)).toBeNull();
  act(() => useGame.getState().dispatch(1, { type: 'concede' }));
  await waitFor(() => expect(run().phase).toBe('reward'));
  expect(useProfile.getState().profile.credits).toBe(0);
});

test('pressing Fight twice starts one game, and that game is the one the run waits for', async () => {
  await launch();
  await act(() => Promise.all([startFrontierMatch(), startFrontierMatch()]).then(() => undefined));
  const seed = useGame.getState().config!.seed;
  expect(run()).toMatchObject({ inMatch: true, matchSeed: seed });
  act(() => useGame.getState().dispatch(1, { type: 'concede' }));
  await waitFor(() => expect(run().phase).toBe('reward'));
});

test('a fight is not started when the run could not begin it (e.g. it just ended)', async () => {
  await launch({ frontier: { run: { ...hubRun(), lives: 1, inMatch: true, matchSeed: 5 }, hallOfFame: [] } });
  // The screen settles the unfinished fight as a loss (the last life) while Fight is pressed.
  await act(() => startFrontierMatch());
  await waitFor(() => expect(run().phase).toBe('over'));
  expect(useGame.getState().config).toBeNull();
});
