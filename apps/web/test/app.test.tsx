import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { App } from '../src/App.tsx';

test('the home screen shows the title and a Play button', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /Pokémon TCG/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Play/ })).toBeInTheDocument();
});
