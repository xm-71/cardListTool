import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { validateGymDeck } from '@ptcg/economy';
import { GYM_SET } from '@ptcg/cards';
import { beforeEach, expect, test } from 'vitest';
import { App } from '../src/App.tsx';
import { DECKS, deckById, registry } from '../src/game/catalog.ts';
import { useGame } from '../src/game/store.ts';
import { useNav } from '../src/nav/useNav.ts';
import { createMemoryStore } from '../src/profile/memoryStore.ts';
import { newProfile, type CustomDeck, type Profile } from '../src/profile/types.ts';
import { useProfile } from '../src/profile/useProfile.ts';
import { useSettings } from '../src/settings/useSettings.ts';

const never = { choose: () => new Promise<never>(() => {}) };
const theme = DECKS.find((d) => d.kind === 'theme')!;
const lucario = deckById('mega-lucario').list.cards;
const good: CustomDeck = { id: 'a', name: 'Good deck', cards: lucario.map((c) => ({ ...c })) };
const broken: CustomDeck = { id: 'b', name: 'Broken deck', cards: lucario.slice(1).map((c) => ({ ...c })) };

const collection = (...lists: { id: string; count: number }[][]) => {
  const out: Record<string, number> = {};
  for (const l of lists) for (const c of l) out[c.id] = (out[c.id] ?? 0) + c.count;
  return out;
};

/** A custom deck with one 151-set card in place of a card of the Lucario deck: valid only in Gym Challenge. */
function gymOnlyDeck(): CustomDeck {
  const picked = Object.values(registry.defs).filter(
    (d) => d.id.startsWith(`${GYM_SET}-`) && d.category !== 'Energy',
  );
  for (const def of picked) {
    const cards = lucario.map((c) => ({ ...c }));
    const last = cards.findIndex((c) => registry.defs[c.id]?.category === 'Energy');
    cards[last]!.count -= 1;
    cards.push({ id: def.id, count: 1 });
    const deck = { id: 'g', name: 'Gym deck', cards };
    if (validateGymDeck({ name: deck.name, cards }, registry, collection(cards)).length === 0) return deck;
  }
  throw new Error('no 151 card works');
}

async function launch(profile: Partial<Profile> = {}, returnTo?: 'duel' | 'decks' | 'menu') {
  useGame.getState().reset();
  useProfile.getState().reset();
  useNav.setState({ route: 'deckcase', returnTo: returnTo ?? null });
  const gym = gymOnlyDeck();
  await act(() =>
    useProfile.getState().init(
      createMemoryStore({
        ...newProfile(),
        introDone: true,
        ownedDecks: ['mega-gengar', theme.id],
        starterDeck: 'mega-gengar',
        decks: [good, broken, gym],
        collection: collection(deckById('mega-gengar').list.cards, theme.list.cards, lucario, gym.cards),
        ...profile,
      }),
      true,
    ),
  );
  render(<App botClient={never} botDelayMs={0} />);
}

const box = (name: string) => screen.getByRole('button', { name: `View ${name}` });
beforeEach(() => useSettings.getState().setSound(false));

test('lists owned premade decks then custom decks, and marks the active one', async () => {
  await launch();
  const names = screen.getAllByRole('button', { name: /^View / }).map((b) => b.getAttribute('aria-label'));
  expect(names).toEqual([
    'View Mega Gengar ex',
    `View ${theme.name}`,
    'View Good deck',
    'View Broken deck',
    'View Gym deck',
  ]);
  expect(box('Mega Gengar ex')).toHaveTextContent('ACTIVE');
  expect(box(theme.name)).not.toHaveTextContent('ACTIVE');
  expect(box('Gym deck')).toHaveTextContent('Gym only');
});

test('a deck that cannot be played shows its problem and cannot be made active', async () => {
  await launch();
  expect(box('Broken deck')).toHaveTextContent('Not a legal deck:');
  fireEvent.click(box('Broken deck'));
  expect(screen.getByRole('button', { name: 'Use this deck' })).toBeDisabled();
});

test('the preview lists 60 cards; Use this deck makes it active and returns to the opener', async () => {
  await launch({}, 'duel');
  fireEvent.click(box(theme.name));
  const list = screen.getByRole('region', { name: 'Deck list' });
  const total = within(list)
    .getAllByTestId('deck-count')
    .reduce((n, e) => n + Number(e.textContent!.replace('×', '')), 0);
  expect(total).toBe(60);
  await act(async () => void fireEvent.click(screen.getByRole('button', { name: 'Use this deck' })));
  expect(useProfile.getState().profile.activeDeck).toBe(theme.id);
  expect(useNav.getState().route).toBe('duel');
});

test('the active deck offers a disabled "Active deck" button', async () => {
  await launch();
  fireEvent.click(box('Mega Gengar ex'));
  expect(screen.getByRole('button', { name: 'Active deck' })).toBeDisabled();
});

test('Back returns to the opener without changing the active deck', async () => {
  await launch({ activeDeck: 'mega-gengar' }, 'decks');
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(useNav.getState().route).toBe('decks');
  expect(useProfile.getState().profile.activeDeck).toBe('mega-gengar');
});

test('filter chips narrow the boxes', async () => {
  await launch();
  const filters = screen.getByRole('group', { name: 'Filter decks' });
  fireEvent.click(within(filters).getByRole('button', { name: 'Custom' }));
  expect(screen.queryByRole('button', { name: 'View Mega Gengar ex' })).toBeNull();
  expect(box('Good deck')).toBeInTheDocument();
  fireEvent.click(within(filters).getByRole('button', { name: 'Premade' }));
  expect(screen.queryByRole('button', { name: 'View Good deck' })).toBeNull();
  expect(box('Mega Gengar ex')).toBeInTheDocument();
});

test('with no custom decks the Custom chip is hidden and a note points to the Deck Builder', async () => {
  await launch({ decks: [] });
  const filters = screen.getByRole('group', { name: 'Filter decks' });
  expect(within(filters).queryByRole('button', { name: 'Custom' })).toBeNull();
  expect(screen.getByText('Build your own decks in the Deck Builder.')).toBeInTheDocument();
});

test('Collector mode closes the Deck Case', async () => {
  await launch({ collectorMode: true });
  expect(useNav.getState().route).toBe('menu');
});
