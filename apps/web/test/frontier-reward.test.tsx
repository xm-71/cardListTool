import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { App } from '../src/App.tsx';
import { registry } from '../src/game/catalog.ts';
import { runDeckProblems } from '../src/game/frontier/deck.ts';
import { FRONTIER_BRAINS } from '../src/game/frontier/opponents.ts';
import {
  beginFight,
  chooseStarter,
  newRun,
  recordResult,
  skipOffer,
  type FrontierRun,
} from '../src/game/frontier/run.ts';
import { useGame } from '../src/game/store.ts';
import { useNav } from '../src/nav/useNav.ts';
import { createMemoryStore } from '../src/profile/memoryStore.ts';
import { newProfile, type Profile } from '../src/profile/types.ts';
import { useProfile } from '../src/profile/useProfile.ts';
import { useSettings } from '../src/settings/useSettings.ts';
import { FrontierGameOver } from '../src/ui/FrontierGameOver.tsx';

const never = { choose: () => new Promise<never>(() => {}) };
const base = () => chooseStarter(newRun(31), newRun(31).starterChoices[0]!);
const winsThenHub = (n: number): FrontierRun => {
  let r = base();
  for (let i = 0; i < n; i++) r = skipOffer(recordResult(beginFight(r), 'win'));
  return r;
};
/** A run in the reward phase after winning fight `n + 1`. */
const rewardAfter = (n: number) => recordResult(beginFight(winsThenHub(n)), 'win');
const run = () => useProfile.getState().profile.frontier.run;
const name = (id: string) => registry.defs[id]!.name;

async function launch(profile: Partial<Profile> = {}) {
  useGame.getState().reset();
  useProfile.getState().reset();
  useNav.setState({ route: 'frontier' });
  await useProfile
    .getState()
    .init(createMemoryStore({ ...newProfile(), introDone: true, playerName: 'ASH', ...profile }), true);
  render(<App botClient={never} botDelayMs={0} />);
}

beforeEach(() => useSettings.getState().setSound(false));

test('reward phase shows 3 offers with their cards, plus Skip', async () => {
  const r = rewardAfter(0);
  await launch({ frontier: { run: r, hallOfFame: [] } });
  const offers = await screen.findByRole('list', { name: 'Offers' });
  expect(offers.children).toHaveLength(3);
  for (const o of r.offers!)
    if (o.kind === 'package')
      for (const c of o.pkg.cards) expect(within(offers).getAllByText(name(c.id)).length).toBeGreaterThan(0);
  expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
});

test('taking a package opens the cut picker; Confirm stays disabled until exactly N cards are picked and the deck is legal', async () => {
  const r = rewardAfter(0);
  await launch({ frontier: { run: r, hallOfFame: [] } });
  const i = r.offers!.findIndex((o) => o.kind === 'package');
  const pkg = (r.offers![i] as { pkg: { cards: { id: string; count: number }[] } }).pkg;
  const n = pkg.cards.reduce((s, c) => s + c.count, 0);
  fireEvent.click(await screen.findByRole('button', { name: `Take offer ${i + 1}` }));
  const picker = await screen.findByRole('region', { name: 'Cut cards' });
  const confirm = within(picker).getByRole('button', { name: 'Confirm cut' });
  expect(confirm).toBeDisabled();
  // Cut N basic Energy (a starter deck has plenty).
  const energy = r.deck.find((c) => {
    const d = registry.defs[c.id]!;
    return d.category === 'Energy' && d.energyKind === 'Basic';
  })!;
  for (let k = 0; k < n; k++) {
    if (k === n - 1) expect(confirm).toBeDisabled();
    fireEvent.click(within(picker).getByRole('button', { name: `Cut ${name(energy.id)}` }));
  }
  expect(confirm).toBeEnabled();
  fireEvent.click(confirm);
  await waitFor(() => expect(run()).toMatchObject({ phase: 'hub', fight: 1 }));
  expect(runDeckProblems(run()!.deck, registry)).toEqual([]);
  expect(run()!.deck.find((c) => c.id === energy.id)!.count).toBe(energy.count - n);
});

test('a Tune-up lets the player cut 0-3 cards and pick a basic Energy type for each', async () => {
  const r = rewardAfter(1);
  await launch({ frontier: { run: r, hallOfFame: [] } });
  const i = r.offers!.findIndex((o) => o.kind === 'tuneup');
  fireEvent.click(await screen.findByRole('button', { name: `Take offer ${i + 1}` }));
  const picker = await screen.findByRole('region', { name: 'Cut cards' });
  const trainer = r.deck.find((c) => registry.defs[c.id]!.category === 'Trainer' && c.count >= 2)!;
  fireEvent.click(within(picker).getByRole('button', { name: `Cut ${name(trainer.id)}` }));
  fireEvent.click(within(picker).getByRole('button', { name: `Cut ${name(trainer.id)}` }));
  fireEvent.change(within(picker).getByRole('combobox', { name: 'Energy 1' }), {
    target: { value: 'Water' },
  });
  fireEvent.change(within(picker).getByRole('combobox', { name: 'Energy 2' }), { target: { value: 'Fire' } });
  const water = r.deck.find((c) => c.id === 'mee-003')?.count ?? 0;
  const fire = r.deck.find((c) => c.id === 'mee-002')?.count ?? 0;
  fireEvent.click(within(picker).getByRole('button', { name: 'Confirm cut' }));
  await waitFor(() => expect(run()!.phase).toBe('hub'));
  expect(run()!.deck.find((c) => c.id === 'mee-003')!.count).toBe(water + 1);
  expect(run()!.deck.find((c) => c.id === 'mee-002')!.count).toBe(fire + 1);
  expect(run()!.deck.find((c) => c.id === trainer.id)?.count ?? 0).toBe(trainer.count - 2);
});

test('Skip moves on without changing the deck', async () => {
  const r = rewardAfter(0);
  await launch({ frontier: { run: r, hallOfFame: [] } });
  fireEvent.click(await screen.findByRole('button', { name: 'Skip' }));
  await waitFor(() => expect(run()).toMatchObject({ phase: 'hub', fight: 1 }));
  expect(run()!.deck).toEqual(r.deck);
});

const props = { human: 0 as const, onBack: () => {}, onRetry: () => {} };
const ctx = (fight: number, opponent = 'Rival') => ({ kind: 'frontier' as const, fight, opponent });

test('after a win the Frontier game-over panel says Continue and leads to the reward phase; after a loss it shows lives left and Retry', () => {
  const onBack = vi.fn();
  const onRetry = vi.fn();
  const r = rewardAfter(0);
  const { unmount } = render(
    <FrontierGameOver
      {...props}
      onBack={onBack}
      context={ctx(0)}
      result={{ winner: 0, reason: 'prizes' }}
      run={r}
      payout={{ counted: true, outcome: 'win', lives: 2, phase: 'reward' }}
    />,
  );
  const over = screen.getByRole('dialog', { name: 'Game over' });
  expect(within(over).getByText('You win!')).toBeInTheDocument();
  fireEvent.click(within(over).getByRole('button', { name: 'Continue' }));
  expect(onBack).toHaveBeenCalled();
  unmount();
  render(
    <FrontierGameOver
      {...props}
      onRetry={onRetry}
      context={ctx(0)}
      result={{ winner: 1, reason: 'prizes' }}
      run={{ ...winsThenHub(0), lives: 1 }}
      payout={{ counted: true, outcome: 'loss', lives: 1, phase: 'hub' }}
    />,
  );
  const lost = screen.getByRole('dialog', { name: 'Game over' });
  expect(within(lost).getByText('You lose')).toBeInTheDocument();
  expect(within(lost).getByText(/Lives left: 1/)).toBeInTheDocument();
  fireEvent.click(within(lost).getByRole('button', { name: 'Retry fight' }));
  expect(onRetry).toHaveBeenCalled();
});

test("the boss's intro, win and lose lines appear on the boss fight's panels", async () => {
  const hub = winsThenHub(7);
  const brain = FRONTIER_BRAINS[hub.opponents[7]!.id]!;
  await launch({ frontier: { run: hub, hallOfFame: [] } });
  expect(await screen.findByText(brain.intro)).toBeInTheDocument();
  render(
    <FrontierGameOver
      {...props}
      context={ctx(7, brain.name)}
      result={{ winner: 1, reason: 'prizes' }}
      run={{ ...hub, lives: 1 }}
      payout={{ counted: true, outcome: 'loss', lives: 1, phase: 'hub' }}
    />,
  );
  expect(screen.getByText(new RegExp(brain.lose.slice(0, 20)))).toBeInTheDocument();
});

test('the end-of-run screen shows fights won and credits, a keep-1-card picker (basic Energy not listed, decline allowed), then the Hall of Fame', async () => {
  const over = recordResult(recordResult(beginFight(winsThenHub(3)), 'loss'), 'loss');
  await launch({ credits: 0, frontier: { run: over, hallOfFame: [] } });
  expect(await screen.findByText('Fights won: 3 of 8')).toBeInTheDocument();
  expect(screen.getByText('+180 credits')).toBeInTheDocument();
  const keep = screen.getByRole('radiogroup', { name: 'Keep one card' });
  const options = within(keep)
    .getAllByRole('radio')
    .map((r) => r.getAttribute('aria-label'));
  expect(options).toContain('Keep nothing');
  const basicEnergy = over.deck
    .map((c) => registry.defs[c.id]!)
    .filter((d) => d.category === 'Energy' && d.energyKind === 'Basic')
    .map((d) => d.name);
  expect(basicEnergy.length).toBeGreaterThan(0);
  for (const e of basicEnergy) expect(options).not.toContain(e);
  const pokemon = over.deck.find((c) => registry.defs[c.id]!.category === 'Pokemon')!;
  fireEvent.click(within(keep).getByRole('radio', { name: name(pokemon.id) }));
  fireEvent.click(screen.getByRole('button', { name: 'Claim rewards' }));
  await waitFor(() => expect(run()).toBeNull());
  expect(useProfile.getState().profile.credits).toBe(180);
  expect(useProfile.getState().profile.collection[pokemon.id]).toBe(1);
  expect(await screen.findByRole('heading', { name: /Frontier Hall of Fame/i })).toBeInTheDocument();
});

test('a cleared run shows up in the Hall of Fame list', async () => {
  const cleared = recordResult(beginFight(winsThenHub(7)), 'win');
  await launch({ frontier: { run: cleared, hallOfFame: [] } });
  expect(await screen.findByText('Run cleared!')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('radio', { name: 'Keep nothing' }));
  fireEvent.click(screen.getByRole('button', { name: 'Claim rewards' }));
  const hall = await screen.findByRole('list', { name: 'Frontier Hall of Fame' });
  expect(within(hall).getByText('ASH')).toBeInTheDocument();
});
