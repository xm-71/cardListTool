import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { GYM_DECKS } from '@ptcg/cards';
import { App } from '../src/App.tsx';
import { LEADERS, type GymProgress, type RunDeck } from '../src/game/gym.ts';
import { DECKS } from '../src/game/catalog.ts';
import { useGame } from '../src/game/store.ts';
import { useNav, type Route } from '../src/nav/useNav.ts';
import { createMemoryStore } from '../src/profile/memoryStore.ts';
import { newProfile, type Profile } from '../src/profile/types.ts';
import { useProfile } from '../src/profile/useProfile.ts';
import { useSettings } from '../src/settings/useSettings.ts';
import { GymGameOver } from '../src/ui/GymGameOver.tsx';

/** A run deck copied from a starter or theme deck. */
const runDeck = (id: string): RunDeck => {
  const d = DECKS.find((x) => x.id === id)!;
  return { kind: d.kind, id: d.id, name: d.name, cover: d.cover, cards: d.list.cards.map((c) => ({ ...c })) };
};

const never = { choose: () => new Promise<never>(() => {}) };
const ids = LEADERS.map((l) => l.id);
const gymOf = (badges: number, extra: Partial<GymProgress> = {}): GymProgress => ({
  badges: ids.slice(0, badges),
  run: null,
  hallOfFame: [],
  ...extra,
});

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

const tile = (name: string) =>
  within(screen.getByRole('list', { name: 'Badge case' })).getByRole('listitem', { name });

test('the main menu has Gym Challenge after Duel, and Collector mode hides it', async () => {
  await launch('menu');
  const items = within(screen.getByRole('menu', { name: 'Main menu' })).getAllByRole('menuitem');
  expect(items.map((i) => i.textContent?.replace('▶', '').trim()).slice(0, 2)).toEqual([
    'Duel',
    'Gym Challenge',
  ]);
  fireEvent.click(items[1]!);
  expect(await screen.findByRole('list', { name: 'Badge case' })).toBeInTheDocument();
});

test('Collector mode hides Gym Challenge and sends the route back to the menu', async () => {
  await launch('gym', { collectorMode: true });
  await waitFor(() => expect(screen.getByRole('menu', { name: 'Main menu' })).toBeInTheDocument());
  const labels = within(screen.getByRole('menu', { name: 'Main menu' }))
    .getAllByRole('menuitem')
    .map((i) => i.textContent);
  expect(labels.join()).not.toMatch(/Gym/);
});

test('a new player can only challenge Brock', async () => {
  await launch('gym');
  expect(within(tile('Brock')).getByRole('button', { name: 'Challenge Brock' })).toBeEnabled();
  expect(within(tile('Misty')).getByRole('button', { name: 'Locked' })).toBeDisabled();
  expect(within(tile('Giovanni')).getByText('Locked')).toBeInTheDocument();
  expect(screen.getByText(/Badges: 0 \/ 8/)).toBeInTheDocument();
  expect(within(tile('Brock')).getByText(/100 credits \+ a 151 pack/)).toBeInTheDocument();
});

test('beaten gyms show their badge and can be rematched; the next gym unlocks', async () => {
  await launch('gym', { gym: gymOf(2) });
  expect(within(tile('Brock')).getByText('★ Boulder Badge')).toBeInTheDocument();
  expect(within(tile('Brock')).getByRole('button', { name: 'Rematch Brock' })).toBeEnabled();
  expect(within(tile('Lt. Surge')).getByRole('button', { name: 'Challenge Lt. Surge' })).toBeEnabled();
  expect(within(tile('Erika')).getByRole('button', { name: 'Locked' })).toBeDisabled();
  expect(screen.getByText(/Badges: 2 \/ 8/)).toBeInTheDocument();
});

test('the Elite Four panel shows locked, ready and in-progress states', async () => {
  await launch('gym', { gym: gymOf(3) });
  expect(screen.getByText(/Earn all 8 badges to enter \(3 \/ 8\)/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Start Elite Four' })).toBeDisabled();
});

test('with 8 badges the Elite Four can be started', async () => {
  await launch('gym', { gym: gymOf(8) });
  expect(screen.getByRole('button', { name: 'Start Elite Four' })).toBeEnabled();
});

test('a run in progress shows the stage and can be continued', async () => {
  await launch('gym', { gym: gymOf(8, { run: { stage: 2, deck: runDeck('mega-gengar') } }) });
  expect(screen.getByText(/next up is Agatha \(match 3 of 5\)/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Continue run' })).toBeEnabled();
  const order = screen.getByRole('list', { name: 'Elite Four order' });
  expect(
    within(order)
      .getByText(/3\. Agatha/)
      .closest('li'),
  ).toHaveAttribute('aria-current', 'step');
});

test('the Hall of Fame lists Champions newest first', async () => {
  await launch('gym', {
    gym: gymOf(8, {
      hallOfFame: [
        { date: '2026-10-10', playerName: 'ASH', deckName: 'Mega Lucario ex', cover: 'me01-077' },
        { date: '2026-10-09', playerName: 'ASH', deckName: 'Mega Gengar ex', cover: 'me02-056' },
      ],
    }),
  });
  const rows = within(screen.getByRole('list', { name: 'Hall of Fame' })).getAllByRole('listitem');
  expect(rows[0]).toHaveTextContent('Mega Lucario ex');
  expect(rows[0]).toHaveTextContent('2026-10-10');
  expect(rows[1]).toHaveTextContent('Mega Gengar ex');
});

test('Challenge shows the leader’s intro and the Gym deck picker, then Battle starts an Easy-bot game against that gym', async () => {
  await launch('gym');
  fireEvent.click(screen.getByRole('button', { name: 'Challenge Brock' }));
  expect(screen.getByText(/Brock's Gym/)).toBeInTheDocument();
  const picker = screen.getByRole('group', { name: 'Your deck' });
  expect(within(picker).getByRole('group', { name: 'Starter decks' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Battle!' }));
  const { config } = useGame.getState();
  expect(config).toMatchObject({ mode: 'bot', difficulty: 'easy', botDeck: GYM_DECKS.brock });
  expect(config?.context).toMatchObject({ kind: 'gym', leaderId: 'brock' });
});

test('Medium-bot gyms use the Medium bot', async () => {
  await launch('gym', { gym: gymOf(4) });
  fireEvent.click(screen.getByRole('button', { name: 'Challenge Koga' }));
  fireEvent.click(screen.getByRole('button', { name: 'Battle!' }));
  expect(useGame.getState().config).toMatchObject({ difficulty: 'medium', botDeck: GYM_DECKS.koga });
});

test('a custom deck with 151 cards is offered in Gym Challenge', async () => {
  await launch('gym', {
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
  fireEvent.click(screen.getByRole('button', { name: 'Challenge Brock' }));
  expect(
    within(screen.getByRole('group', { name: 'Custom decks' })).getByText('Rock Party'),
  ).toBeInTheDocument();
});

test('Start Elite Four locks the chosen deck and starts with Lorelei', async () => {
  await launch('gym', { gym: gymOf(8) });
  fireEvent.click(screen.getByRole('button', { name: 'Start Elite Four' }));
  fireEvent.click(screen.getByRole('button', { name: /Mega Lucario ex/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Battle!' }));
  await waitFor(() => expect(useGame.getState().config?.context).toMatchObject({ kind: 'elite', stage: 0 }));
  expect(useGame.getState().config?.botDeck).toBe(GYM_DECKS.lorelei);
  expect(useProfile.getState().profile.gym.run).toMatchObject({
    stage: 0,
    inMatch: true,
    deck: { id: 'mega-lucario', name: 'Mega Lucario ex' },
  });
  expect(useProfile.getState().profile.gym.run?.deck.cards.length).toBeGreaterThan(0);
});

test('the Champion’s ace counters the main Energy of the run deck', async () => {
  // Mega Charizard X ex is a Fire deck: Blue answers with the Blastoise ex list.
  await launch('gym', {
    gym: gymOf(8, { run: { stage: 4, deck: runDeck('mega-charizard-x') } }),
  });
  fireEvent.click(screen.getByRole('button', { name: 'Continue run' }));
  expect(screen.getByText(/locked for this run/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Battle!' }));
  await waitFor(() => expect(useGame.getState().config?.context).toMatchObject({ kind: 'elite', stage: 4 }));
  expect(useGame.getState().config?.botDeck).toBe(GYM_DECKS['blue-water']);
});

test('a lost gym match shows the leader’s line, pays normal credits once and keeps the badge case unchanged', async () => {
  await launch('gym', { credits: 0 });
  fireEvent.click(screen.getByRole('button', { name: 'Challenge Brock' }));
  fireEvent.click(screen.getByRole('button', { name: 'Battle!' }));
  act(() => useGame.getState().dispatch(0, { type: 'concede' }));
  const over = await screen.findByRole('dialog', { name: 'Game over' });
  expect(within(over).getByText(/You lose/)).toBeInTheDocument();
  expect(within(over).getByText(/Brock:/)).toBeInTheDocument();
  await waitFor(() => expect(useProfile.getState().profile.awardedGames).toHaveLength(1));
  expect(useProfile.getState().profile.gym.badges).toEqual([]);
  expect(useProfile.getState().profile.credits).toBe(0); // a concede pays nothing, like Duel
  fireEvent.click(within(over).getByRole('button', { name: 'Gym Challenge' }));
  expect(await screen.findByRole('list', { name: 'Badge case' })).toBeInTheDocument();
});

const props = {
  human: 0 as const,
  onBack: () => {},
  onRematch: () => {},
  onNext: () => {},
};
const win = { winner: 0 as const, reason: 'prizes' as const };

test('GymGameOver: a first win shows the badge, the credits and a pack to open', () => {
  render(
    <GymGameOver
      {...props}
      context={{ kind: 'gym', leaderId: 'brock', deck: { kind: 'starter', id: 'mega-gengar' } }}
      result={win}
      payout={{ credits: 100, packs: [Array(10).fill('sv03.5-074')], badge: true, champion: false }}
    />,
  );
  expect(screen.getByText('Boulder Badge earned!')).toBeInTheDocument();
  expect(screen.getByText('+100 credits')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Open pack 1 of 1' }));
  expect(screen.getByRole('dialog', { name: 'Pack opening' })).toBeInTheDocument();
});

test('GymGameOver: an Elite Four win offers the next opponent; a loss ends the run', () => {
  const elite = {
    kind: 'elite' as const,
    stage: 1,
    deck: { kind: 'starter' as const, id: 'x' },
    deckName: 'D',
    cover: 'me02-056',
  };
  const payout = { credits: 0, packs: [], badge: false, champion: false };
  const { unmount } = render(<GymGameOver {...props} context={elite} result={win} payout={payout} />);
  expect(screen.getByRole('button', { name: 'Next: Agatha' })).toBeEnabled();
  unmount();
  render(<GymGameOver {...props} context={elite} result={{ winner: 1, reason: 'prizes' }} payout={payout} />);
  expect(screen.queryByRole('button', { name: /Next:/ })).toBeNull();
  expect(screen.getByText('You lose')).toBeInTheDocument();
});

test('GymGameOver: beating the Champion shows the Champion title and 3 packs', () => {
  const champion = {
    kind: 'elite' as const,
    stage: 4,
    deck: { kind: 'starter' as const, id: 'x' },
    deckName: 'D',
    cover: 'me02-056',
  };
  render(
    <GymGameOver
      {...props}
      context={champion}
      result={win}
      payout={{
        credits: 1000,
        packs: [[], [], []].map(() => Array(10).fill('sv03.5-074')),
        badge: false,
        champion: true,
      }}
    />,
  );
  expect(screen.getByText('Champion!')).toBeInTheDocument();
  expect(screen.getByText('+1000 credits')).toBeInTheDocument();
  expect(screen.getByText('You won 3 Scarlet & Violet 151 packs!')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Next:/ })).toBeNull();
});

test('the run keeps playing its saved copy of the deck, even if the deck is edited or deleted', async () => {
  const saved = runDeck('mega-lucario');
  await launch('gym', {
    gym: gymOf(8, { run: { stage: 1, deck: saved } }),
    decks: [{ id: 'mega-lucario', name: 'Edited', cards: [{ id: 'mee-006', count: 60 }] }],
  });
  fireEvent.click(screen.getByRole('button', { name: 'Continue run' }));
  expect(screen.getByText(/Mega Lucario ex \(locked for this run\)/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Battle!' }));
  await waitFor(() => expect(useGame.getState().config?.context).toMatchObject({ kind: 'elite', stage: 1 }));
  expect(useGame.getState().config?.humanDeck.cards).toEqual(saved.cards);
});

test('quitting an Elite Four match counts as a loss and ends the run', async () => {
  await launch('gym', { gym: gymOf(8, { run: { stage: 1, deck: runDeck('mega-gengar') } }) });
  fireEvent.click(screen.getByRole('button', { name: 'Continue run' }));
  fireEvent.click(screen.getByRole('button', { name: 'Battle!' }));
  await waitFor(() => expect(useGame.getState().config?.context).toMatchObject({ kind: 'elite', stage: 1 }));
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  fireEvent.click(await screen.findByRole('button', { name: 'Quit to home' }));
  const over = await screen.findByRole('dialog', { name: 'Game over' });
  expect(within(over).getByText(/You lose/)).toBeInTheDocument();
  await waitFor(() => expect(useProfile.getState().profile.gym.run).toBeNull());
});

test('a run whose match never finished (the page was reloaded) ends when Gym Challenge opens', async () => {
  await launch('gym', {
    gym: gymOf(8, { run: { stage: 2, deck: runDeck('mega-gengar'), inMatch: true } }),
  });
  await waitFor(() => expect(useProfile.getState().profile.gym.run).toBeNull());
  expect(screen.getByRole('button', { name: 'Start Elite Four' })).toBeEnabled();
});

test('the badge case and the intro show character portraits, not card art', async () => {
  await launch('gym');
  const list = screen.getByRole('list', { name: 'Badge case' });
  expect(list.querySelectorAll('svg')).toHaveLength(8);
  expect(list.querySelectorAll('img')).toHaveLength(0);
  const order = screen.getByRole('list', { name: 'Elite Four order' });
  expect(order.querySelectorAll('svg')).toHaveLength(5);
  fireEvent.click(screen.getByRole('button', { name: 'Challenge Brock' }));
  expect(screen.getByRole('img', { name: 'Brock' })).toBeInTheDocument();
});

describe('draws', () => {
  const draw = { winner: 'draw' as const, reason: 'noPokemon' as const };
  const elite = {
    kind: 'elite' as const,
    stage: 1,
    deck: { kind: 'starter' as const, id: 'x' },
    deckName: 'D',
    cover: 'me02-056',
  };
  const payout = { credits: 0, packs: [], badge: false, champion: false };

  test('a drawn Gym match says Draw, not "You lose", and offers another try', () => {
    render(
      <GymGameOver
        {...props}
        context={{ kind: 'gym', leaderId: 'brock', deck: { kind: 'starter', id: 'mega-gengar' } }}
        result={draw}
        payout={{ ...payout, credits: 30 }}
      />,
    );
    expect(screen.getByText('Draw')).toBeInTheDocument();
    expect(screen.queryByText('You lose')).toBeNull();
    expect(screen.getByText("It's a draw. Nobody takes the win.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
  });

  test('a drawn Elite Four match keeps the run and offers to replay the same opponent', () => {
    const onNext = vi.fn();
    render(<GymGameOver {...props} onNext={onNext} context={elite} result={draw} payout={payout} />);
    expect(screen.getByText('Draw')).toBeInTheDocument();
    expect(screen.getByText('The match is replayed. Your run continues.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Replay: Bruno' }));
    expect(onNext).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Next:/ })).toBeNull();
  });
});

describe('what the result screen announces', () => {
  const win = { winner: 0 as const, reason: 'prizes' as const };
  const elite = {
    kind: 'elite' as const,
    stage: 1,
    deck: { kind: 'starter' as const, id: 'x' },
    deckName: 'D',
    cover: 'me02-056',
  };

  test('the saving state and the rewards are in a polite live region', () => {
    const { rerender } = render(<GymGameOver {...props} context={elite} result={win} payout={undefined} />);
    const live = screen.getByRole('status');
    expect(live).toHaveAttribute('aria-live', 'polite');
    expect(live).toHaveTextContent('Saving…');
    rerender(
      <GymGameOver
        {...props}
        context={elite}
        result={win}
        payout={{ credits: 125, packs: [Array(10).fill('sv03.5-074')], badge: false, champion: false }}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('+125 credits');
    expect(screen.getByRole('status')).toHaveTextContent('You won a Scarlet & Violet 151 pack!');
  });

  test('a result that did not count says so', () => {
    render(
      <GymGameOver
        {...props}
        context={elite}
        result={win}
        payout={{ credits: 0, packs: [], badge: false, champion: false, counted: false }}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'This match did not count: your run has moved on (maybe in another tab).',
    );
  });
});

describe('rematch', () => {
  async function lostMatchWith(
    deck: { kind: 'starter' | 'theme' | 'custom'; id: string },
    profile: Partial<Profile> = {},
  ) {
    await launch('gym', { credits: 0, ...profile });
    act(() =>
      useGame.getState().start({
        mode: 'bot',
        difficulty: 'easy',
        humanDeck: DECKS[0]!.list,
        botDeck: GYM_DECKS.brock,
        seed: 1,
        context: { kind: 'gym', leaderId: 'brock', deck },
      }),
    );
    act(() => useGame.getState().dispatch(0, { type: 'concede' }));
    return screen.findByRole('dialog', { name: 'Game over' });
  }

  test('a rematch with a starter deck starts a new match against the same leader', async () => {
    const over = await lostMatchWith({ kind: 'starter', id: 'mega-gengar' });
    fireEvent.click(within(over).getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(useGame.getState().state?.result).toBeNull());
    expect(useGame.getState().config?.context).toMatchObject({ kind: 'gym', leaderId: 'brock' });
  });

  test('a rematch whose deck was deleted goes back to the Gym Challenge to pick another', async () => {
    const over = await lostMatchWith({ kind: 'custom', id: 'ghost' });
    fireEvent.click(within(over).getByRole('button', { name: 'Try again' }));
    expect(useGame.getState().state).toBeNull();
    expect(await screen.findByRole('list', { name: 'Badge case' })).toBeInTheDocument();
  });

  test('a rematch whose deck is no longer Gym-legal goes back to pick another instead of playing it', async () => {
    const over = await lostMatchWith(
      { kind: 'custom', id: 'mine' },
      { decks: [{ id: 'mine', name: 'Mine', cards: [{ id: 'sv03.5-074', count: 60 }] }] },
    );
    fireEvent.click(within(over).getByRole('button', { name: 'Try again' }));
    expect(useGame.getState().state).toBeNull();
    expect(await screen.findByRole('list', { name: 'Badge case' })).toBeInTheDocument();
  });
});
