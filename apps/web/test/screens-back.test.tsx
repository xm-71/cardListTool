import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, test } from 'vitest';
import { useNav } from '../src/nav/useNav.ts';
import { Binder } from '../src/screens/Binder.tsx';
import { DeckBuilder } from '../src/screens/DeckBuilder.tsx';
import { Shop } from '../src/screens/Shop.tsx';

beforeEach(() => useNav.setState({ route: 'shop' }));

test.each([
  ['Shop', Shop],
  ['Binder', Binder],
  ['DeckBuilder', DeckBuilder],
])('%s has a Back button to the main menu', (_name, Screen) => {
  render(<Screen />);
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(useNav.getState().route).toBe('menu');
});

test('the shop draws a booster pack for each set', () => {
  render(<Shop />);
  expect(screen.getAllByTestId('pack-art')).toHaveLength(10);
});
