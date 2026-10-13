import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { GYM_SET } from '@ptcg/cards';
import { validateGymDeck } from '@ptcg/economy';
import { beforeEach, expect, test } from 'vitest';
import { App } from '../src/App.tsx';
import { DECKS, deckById, registry } from '../src/game/catalog.ts';
import { useGame } from '../src/game/store.ts';
import { useNav, type Route } from '../src/nav/useNav.ts';
import { createMemoryStore } from '../src/profile/memoryStore.ts';
import { newProfile, type CustomDeck, type Profile } from '../src/profile/types.ts';
import { useProfile } from '../src/profile/useProfile.ts';
import { useSettings } from '../src/settings/useSettings.ts';

const never = { choose: () => new Promise<never>(() => {}) };
const theme = DECKS.find((d) => d.kind === 'theme')!;
const lucario = deckById('mega-lucario').list.cards;

const sum = (...lists: { id: string; count: number }[][]) => {
  const out: Record<string, number> = {};
  for (const l of lists) for (const c of l) out[c.id] = (out[c.id] ?? 0) + c.count;
  return out;
};

/** A custom deck holding one 151-set card: valid in Gym Challenge only. */
function gymOnlyDeck(): CustomDeck {
  for (const def of Object.values(registry.defs)) {
    if (!def.id.startsWith(`${GYM_SET}-`) || def.category === 'Energy') continue;
    const cards = lucario.map((c) => ({ ...c }));
    cards[cards.findIndex((c) => registry.defs[c.id]?.category === 'Energy')]!.count -= 1;
    cards.push({ id: def.id, count: 1 });
    if (validateGymDeck({ name: 'Gym deck', cards }, registry, sum(cards)).length === 0)
      return { id: 'g', name: 'Gym deck', cards };
  }
  throw new Error('no 151 card works');
}

async function launch(route: Route, profile: Partial<Profile> = {}) {
  useGame.getState().reset();
  useProfile.getState().reset();
  useNav.setState({ route, returnTo: null });
  const gym = gymOnlyDeck();
  await act(() =>
    useProfile.getState().init(
      createMemoryStore({
        ...newProfile(),
        introDone: true,
        ownedDecks: ['mega-gengar', theme.id],
        starterDeck: 'mega-gengar',
        decks: [gym],
        collection: sum(deckById('mega-gengar').list.cards, theme.list.cards, gym.cards),
        ...profile,
      }),
      true,
    ),
  );
  render(<App botClient={never} botDelayMs={0} />);
}

const panel = () => within(screen.getByRole('heading', { name: 'Your deck' }).parentElement!);
beforeEach(() => useSettings.getState().setSound(false));

test('Play starts a Duel with the active deck', async () => {
  await launch('duel', { activeDeck: theme.id });
  expect(panel().getByText(theme.name)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Play' }));
  expect(useGame.getState().config?.humanDeck).toBe(theme.list);
});

test('Change opens the Deck Case and Use this deck comes back to Duel with the new deck', async () => {
  await launch('duel');
  fireEvent.click(screen.getByRole('button', { name: 'Change' }));
  expect(useNav.getState().route).toBe('deckcase');
  fireEvent.click(screen.getByRole('button', { name: `View ${theme.name}` }));
  await act(async () => void fireEvent.click(screen.getByRole('button', { name: 'Use this deck' })));
  expect(useNav.getState().route).toBe('duel');
  expect(panel().getByText(theme.name)).toBeInTheDocument();
});

test('Back from the Deck Case changes nothing', async () => {
  await launch('duel', { activeDeck: theme.id });
  fireEvent.click(screen.getByRole('button', { name: 'Change' }));
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(useNav.getState().route).toBe('duel');
  expect(panel().getByText(theme.name)).toBeInTheDocument();
});

test('a deleted custom active deck falls back to the starter', async () => {
  await launch('duel', { activeDeck: 'custom:gone' });
  expect(panel().getByText('Mega Gengar ex')).toBeInTheDocument();
});

test('a Gym-only active deck disables Play in Duel with a notice, but not in Gym', async () => {
  await launch('duel', { activeDeck: 'custom:g' });
  expect(screen.getByText('This deck can only be used in Gym Challenge')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled();
});

test('a Gym-only active deck can battle in Gym Challenge', async () => {
  await launch('gym', { activeDeck: 'custom:g' });
  fireEvent.click(screen.getByRole('button', { name: 'Challenge Brock' }));
  expect(panel().getByText('Gym deck')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Battle!' })).toBeEnabled();
});

test('Change in a Gym setup returns to the same leader', async () => {
  await launch('gym');
  fireEvent.click(screen.getByRole('button', { name: 'Challenge Brock' }));
  fireEvent.click(screen.getByRole('button', { name: 'Change' }));
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByText(/Brock's Gym/)).toBeInTheDocument();
});

test('hotseat: player 1 uses the active deck and player 2 keeps the tile picker', async () => {
  await launch('duel', { activeDeck: theme.id });
  fireEvent.click(screen.getByLabelText(/Hotseat/));
  expect(screen.getByRole('heading', { name: "Player 1's deck" })).toBeInTheDocument();
  expect(within(screen.getByRole('group', { name: "Opponent's deck" })).getAllByRole('button')).toHaveLength(
    15,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Play' }));
  expect(useGame.getState().config?.humanDeck).toBe(theme.list);
});

test('with no deck owned, Play is disabled and the panel points to the Poké Mart', async () => {
  await launch('duel', { ownedDecks: [], introDone: false, starterDeck: null });
  expect(screen.getByText('No deck yet. Buy a deck in the Poké Mart.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled();
});

test('Duel keeps the opponent and the second deck after a trip to the Deck Case', async () => {
  await launch('duel');
  fireEvent.click(screen.getByLabelText('Hard bot'));
  fireEvent.click(screen.getByRole('button', { name: 'Change' }));
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByLabelText('Hard bot')).toBeChecked();
  fireEvent.click(screen.getByLabelText(/Hotseat/));
  fireEvent.click(
    within(screen.getByRole('group', { name: "Opponent's deck" })).getByRole('button', {
      name: /Mega Lucario ex/,
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Change' }));
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByLabelText(/Hotseat/)).toBeChecked();
  expect(
    within(screen.getByRole('group', { name: "Opponent's deck" })).getByRole('button', {
      name: /Mega Lucario ex/,
    }),
  ).toHaveAttribute('aria-pressed', 'true');
});
