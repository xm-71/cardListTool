import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { GameScreen } from '../src/screens/GameScreen.tsx';
import { useGame } from '../src/game/store.ts';
import { botCfg, finishSetupInStore, turnOf } from './helpers.ts';

const media = (matches: boolean) =>
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('max-width') ? matches : false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));

beforeEach(() => {
  localStorage.clear();
  useGame.getState().reset();
  useGame.getState().start(botCfg(1));
  finishSetupInStore();
  turnOf(0);
});
afterEach(() => vi.unstubAllGlobals());

describe('on a wide screen', () => {
  beforeEach(() => media(false));

  test('the side column keeps End turn, Concede and Quit, and there is no bottom bar', () => {
    render(<GameScreen />);
    expect(screen.queryByRole('toolbar', { name: 'Game controls' })).toBeNull();
    expect(screen.getByRole('button', { name: 'End turn' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Concede' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quit to home' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show log' })).toBeNull();
  });
});

describe('board details', () => {
  beforeEach(() => media(false));

  test('the hand is one row that scrolls sideways', () => {
    render(<GameScreen />);
    const hand = screen.getByRole('region', { name: 'Your hand' });
    expect(hand).toHaveClass('flex-nowrap', 'overflow-x-auto');
    expect(hand).not.toHaveClass('flex-wrap');
  });

  test('Energy and Tool overlay the Pokémon on every width', () => {
    render(<GameScreen />);
    const you = screen.getByRole('region', { name: /^You$/ });
    const overlay = you.querySelector('.absolute.inset-x-0.bottom-0\\.5');
    expect(overlay).not.toBeNull();
    expect(overlay!.className).not.toContain('lg:absolute');
  });

  test('empty Bench spaces collapse into a +N chip on a phone', () => {
    render(<GameScreen />);
    const you = screen.getByRole('region', { name: /^You$/ });
    const empty = you.querySelector('[data-empty-bench]');
    expect(empty).not.toBeNull();
    expect(empty).toHaveTextContent(/^\+\d$/);
    expect(empty).toHaveClass('lg:hidden');
    expect(you.querySelectorAll('[data-bench-space]').length).toBe(Number(empty!.textContent!.slice(1)));
  });
});
