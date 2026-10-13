import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { validateCustomDeck } from '@ptcg/economy';
import { beforeEach, expect, test } from 'vitest';
import { App } from '../src/App.tsx';
import { deckById, registry } from '../src/game/catalog.ts';
import { useNav, type Route } from '../src/nav/useNav.ts';
import { createMemoryStore } from '../src/profile/memoryStore.ts';
import { newProfile, type Profile } from '../src/profile/types.ts';
import { useProfile } from '../src/profile/useProfile.ts';
import { useSettings } from '../src/settings/useSettings.ts';
import { TrainerCard } from '../src/ui/town/TrainerCard.tsx';

const never = { choose: () => new Promise<never>(() => {}) };
const lucario = deckById('mega-lucario');

async function launch(route: Route, profile: Partial<Profile> = {}) {
  useProfile.getState().reset();
  useNav.setState({ route, returnTo: null });
  const collection: Record<string, number> = {};
  for (const c of lucario.list.cards) collection[c.id] = c.count;
  await act(() =>
    useProfile.getState().init(
      createMemoryStore({
        ...newProfile(),
        introDone: true,
        playerName: 'ASH',
        ownedDecks: ['mega-gengar', 'mega-lucario'],
        starterDeck: 'mega-gengar',
        collection,
        ...profile,
      }),
      true,
    ),
  );
  render(<App botClient={never} botDelayMs={0} />);
}
beforeEach(() => useSettings.getState().setSound(false));

test('the Deck Builder lists the owned premade decks with View and Copy to edit', async () => {
  await launch('decks');
  const region = screen.getByRole('region', { name: 'Premade decks' });
  expect(within(region).getAllByRole('button', { name: /^View / })).toHaveLength(2);
  expect(within(region).getAllByRole('button', { name: /^Copy to edit / })).toHaveLength(2);
  expect(screen.queryByText(/always available on the Home screen/)).toBeNull();
});

test('View shows the premade deck as a 60-card list', async () => {
  await launch('decks');
  fireEvent.click(screen.getByRole('button', { name: 'View Mega Lucario ex' }));
  const dialog = screen.getByRole('dialog', { name: 'Mega Lucario ex' });
  const counts = within(dialog)
    .getAllByTestId('deck-count')
    .map((e) => Number(e.textContent!.replace('×', '')));
  expect(counts.reduce((a, b) => a + b, 0)).toBe(60);
});

test('Copy to edit opens a "<deck> copy" editor with the deck, valid and savable', async () => {
  await launch('decks');
  fireEvent.click(screen.getByRole('button', { name: 'Copy to edit Mega Lucario ex' }));
  expect(screen.getByDisplayValue('Mega Lucario ex copy')).toBeInTheDocument();
  expect(screen.getByText('60 / 60')).toBeInTheDocument();
  await act(async () => void fireEvent.click(screen.getByRole('button', { name: 'Save deck' })));
  const saved = useProfile.getState().profile.decks.find((d) => d.name === 'Mega Lucario ex copy')!;
  expect(saved.cards).toEqual(lucario.list.cards);
  expect(
    validateCustomDeck(
      { name: saved.name, cards: saved.cards },
      registry,
      useProfile.getState().profile.collection,
    ),
  ).toEqual([]);
});

test('the Deck Builder points to the Deck Case, which returns to the builder', async () => {
  await launch('decks');
  fireEvent.click(screen.getByRole('button', { name: 'Deck Case' }));
  expect(useNav.getState()).toMatchObject({ route: 'deckcase', returnTo: 'decks' });
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(useNav.getState().route).toBe('decks');
});

async function trainerCard(profile: Partial<Profile> = {}) {
  const go: Route[] = [];
  useProfile.getState().reset();
  await act(() =>
    useProfile.getState().init(
      createMemoryStore({
        ...newProfile(),
        introDone: true,
        ownedDecks: ['mega-gengar', 'mega-lucario'],
        starterDeck: 'mega-gengar',
        ...profile,
      }),
      true,
    ),
  );
  render(<TrainerCard onClose={() => {}} onGo={(r) => go.push(r)} />);
  return go;
}

test('the Trainer Card shows the active deck and opens the Deck Case', async () => {
  useNav.setState({ route: 'menu', returnTo: null });
  const go = await trainerCard({ activeDeck: 'mega-lucario' });
  expect(screen.getByText('Mega Lucario ex')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Deck Case' }));
  expect(go).toEqual(['deckcase']);
});

test('the Trainer Card has no Deck Case button in Collector mode', async () => {
  await trainerCard({ collectorMode: true });
  expect(screen.queryByRole('button', { name: 'Deck Case' })).toBeNull();
});

test('the intro previews a starter deck and only Choose continues', async () => {
  useProfile.getState().reset();
  useNav.setState({ route: 'intro', returnTo: null });
  await act(() => useProfile.getState().init(createMemoryStore(), true));
  render(<App botClient={never} botDelayMs={0} />);
  fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'ALEX' } });
  fireEvent.click(screen.getByRole('button', { name: 'OK' }));
  fireEvent.click(screen.getByRole('button', { name: /Mega Lucario ex/ }));
  const dialog = screen.getByRole('dialog', { name: 'Mega Lucario ex' });
  const total = within(dialog)
    .getAllByTestId('deck-count')
    .reduce((n, e) => n + Number(e.textContent!.replace('×', '')), 0);
  expect(total).toBe(60);
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /Mega Lucario ex/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Choose this deck' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(useProfile.getState().profile.activeDeck).toBeNull(); // granted when the intro finishes
  expect(screen.queryByRole('button', { name: /Mega Lucario ex/ })).toBeNull();
});
