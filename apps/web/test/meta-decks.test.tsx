import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, expect, test } from 'vitest';
import { App } from '../src/App.tsx';
import { DECKS, deckById } from '../src/game/catalog.ts';
import { useGame } from '../src/game/store.ts';
import { ownEveryDeck } from './helpers.ts';

const never = { choose: () => new Promise<never>(() => {}) };
const META = [
  'meta-dragapult',
  'meta-alakazam',
  'meta-ogerpon-box',
  'meta-ns-zoroark',
  'meta-slowking',
  'meta-crustle',
] as const;

beforeEach(async () => {
  useGame.getState().reset();
  await ownEveryDeck();
});

test('the six meta decks are in the deck list as meta decks, with a cover card from the deck', () => {
  for (const id of META) {
    const deck = deckById(id);
    expect(deck, id).toBeDefined();
    expect(deck.kind).toBe('meta');
    expect(
      deck.list.cards.some((c) => c.id === deck.cover),
      `${id} cover`,
    ).toBe(true);
  }
  expect(DECKS.filter((d) => d.kind === 'meta')).toHaveLength(6);
});

test('Duel lists the meta decks in their own group, like the theme decks', () => {
  render(<App startAt="duel" botClient={never} botDelayMs={0} />);
  fireEvent.click(screen.getByLabelText(/Hotseat/)); // the opponent's picker lists every premade deck
  const group = screen.getByRole('group', { name: 'Meta decks' });
  expect(within(group).getAllByRole('button')).toHaveLength(6);
  expect(within(group).getByRole('button', { name: /Dragapult ex/ })).toBeInTheDocument();
});
