import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { App } from '../src/App.tsx';

test('the game opens on the title screen', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /Pokémon Trading Card Game/ })).toBeInTheDocument();
});
