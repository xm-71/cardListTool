import { act as rtlAct, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, test } from 'vitest';
import { isPlayable, setCards } from '@ptcg/cards';
import { App } from '../src/App.tsx';
import type { BotClient, BotSetup } from '../src/game/botClient.ts';
import { createSyncBotClient } from '../src/game/botClient.ts';
import { registry } from '../src/game/catalog.ts';
import { useGame } from '../src/game/store.ts';
import { DeckBuilder } from '../src/screens/DeckBuilder.tsx';
import { createMemoryStore } from '../src/profile/memoryStore.ts';
import { useProfile } from '../src/profile/useProfile.ts';
import { newProfile, type CustomDeck } from '../src/profile/types.ts';

const GASTLY = 'me02-054';
const ULTRA_BALL = 'me01-131';
const PSYCHIC = 'mee-005';
const unplayable = setCards('me01').find((c) => c.category === 'Trainer' && !isPlayable(c, registry))!;

const ghosts: CustomDeck = {
  id: 'ghosts',
  name: 'Ghost Party',
  cards: [
    { id: GASTLY, count: 4 },
    { id: PSYCHIC, count: 56 },
  ],
};

async function setProfile(decks: CustomDeck[] = []) {
  useProfile.getState().reset();
  await useProfile.getState().init(
    createMemoryStore({
      ...newProfile(),
      collection: { [GASTLY]: 4, [ULTRA_BALL]: 3, [unplayable.id]: 2 },
      decks,
    }),
    true,
  );
}

beforeEach(async () => {
  useGame.getState().reset();
  await setProfile();
});

const available = () => screen.getByRole('list', { name: 'Available cards' });
const addButton = (name: string) => within(available()).getByRole('button', { name: `Add ${name}` });

describe('deck builder', () => {
  test('adds and removes cards with a live count and validation messages', () => {
    render(<DeckBuilder />);
    fireEvent.click(screen.getByRole('button', { name: 'New deck' }));
    expect(screen.getByText('0 / 60')).toBeInTheDocument();
    fireEvent.click(addButton('Gastly'));
    fireEvent.click(addButton('Gastly'));
    expect(screen.getByText('2 / 60')).toBeInTheDocument();
    const problems = screen.getByRole('list', { name: 'Problems' });
    expect(within(problems).getByText('Deck has 2 cards (needs 60)')).toBeInTheDocument();
    fireEvent.click(
      within(screen.getByRole('list', { name: 'Deck' })).getByRole('button', { name: 'Remove Gastly' }),
    );
    expect(screen.getByText('1 / 60')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save deck' })).toBeDisabled();
  });

  test('(RF4) cannot add more copies than owned, nor unplayable cards', () => {
    render(<DeckBuilder />);
    fireEvent.click(screen.getByRole('button', { name: 'New deck' }));
    for (let i = 0; i < 3; i++) fireEvent.click(addButton('Ultra Ball'));
    expect(addButton('Ultra Ball')).toBeDisabled();
    expect(addButton(unplayable.name)).toBeDisabled();
    expect(within(available()).getByText("Isn't playable yet")).toBeInTheDocument();
  });

  test('Basic Energy is always available and unlimited; a valid deck saves', async () => {
    render(<DeckBuilder />);
    fireEvent.click(screen.getByRole('button', { name: 'New deck' }));
    fireEvent.change(screen.getByLabelText('Deck name'), { target: { value: 'Ghost Party' } });
    for (let i = 0; i < 4; i++) fireEvent.click(addButton('Gastly'));
    for (let i = 0; i < 56; i++) fireEvent.click(addButton('Psychic Energy'));
    expect(screen.getByText('60 / 60')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Problems' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save deck' }));
    await waitFor(() => expect(useProfile.getState().profile.decks).toHaveLength(1));
    expect(useProfile.getState().profile.decks[0]).toMatchObject({
      name: 'Ghost Party',
      cards: expect.arrayContaining([
        { id: GASTLY, count: 4 },
        { id: PSYCHIC, count: 56 },
      ]),
    });
    expect(screen.getByRole('list', { name: 'Saved decks' })).toHaveTextContent('Ghost Party');
  });

  test('a saved deck can be edited and deleted', async () => {
    await setProfile([ghosts]);
    render(<DeckBuilder />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Ghost Party' }));
    expect(screen.getByText('60 / 60')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Ghost Party' }));
    await waitFor(() => expect(useProfile.getState().profile.decks).toEqual([]));
  });
});

describe('custom decks in play', () => {
  test('a saved deck appears in the Home picker and starts a game with its cards', async () => {
    await setProfile([ghosts]);
    render(<App startAt="duel" botClient={{ choose: () => new Promise(() => {}) }} botDelayMs={0} />);
    const yours = screen.getByRole('group', { name: 'Your deck' });
    fireEvent.click(within(yours).getByRole('button', { name: /Ghost Party/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    const { config, state } = useGame.getState();
    expect(config?.humanDeck).toEqual({ name: 'Ghost Party', cards: ghosts.cards });
    const mine = Object.values(state!.cards).filter((c) => c.owner === 0);
    expect(new Set(mine.map((c) => c.defId))).toEqual(new Set([GASTLY, PSYCHIC]));
  });

  test('(RF5) a Medium bot game sends the custom decklist to the bot', async () => {
    await setProfile([ghosts]);
    const seen: BotSetup[] = [];
    const sync = createSyncBotClient();
    const spy: BotClient = {
      choose: (view, legal, rng, setup) => {
        seen.push(setup);
        return sync.choose(view, legal, rng, setup);
      },
    };
    render(<App startAt="duel" botClient={spy} botDelayMs={0} />);
    fireEvent.click(screen.getByLabelText('Medium bot'));
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Your deck' })).getByRole('button', { name: /Ghost Party/ }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    await waitFor(
      () => {
        const st = useGame.getState().state!;
        if (st.prompt?.player === 0) {
          const pr = st.prompt;
          rtlAct(() =>
            useGame.getState().dispatch(0, {
              type: 'answer',
              optionId: pr.selected.length >= pr.min ? 'done' : pr.options[0]!.id,
            }),
          );
        } else if (st.phase === 'main' && st.current === 0 && !st.prompt) {
          rtlAct(() => useGame.getState().dispatch(0, { type: 'endTurn' }));
        }
        expect(seen.length).toBeGreaterThan(0);
      },
      { timeout: 15000 },
    );
    expect(seen[0]!.decks[0]).toEqual({ name: 'Ghost Party', cards: ghosts.cards });
    expect(seen[0]!.decks[1]).toEqual(useGame.getState().config!.botDeck);
  });
});

test('a deck that fails to save shows the error and stays open', async () => {
  useProfile.getState().reset();
  await useProfile.getState().init(
    {
      load: () => Promise.resolve({ ...newProfile(), collection: { [GASTLY]: 4 }, decks: [ghosts] }),
      save: () => Promise.reject(new Error('quota exceeded')),
    },
    true,
  );
  render(<DeckBuilder />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit Ghost Party' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save deck' }));
  expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't save: quota exceeded");
  expect(screen.getByText('60 / 60')).toBeInTheDocument();
});
