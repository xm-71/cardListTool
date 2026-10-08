import { render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import type { SlotView as SlotViewData } from '@ptcg/engine';

const played: string[] = [];
vi.mock('../src/audio/sfx.ts', () => ({ sfx: (n: string) => played.push(n), unlockAudio: () => {} }));
const { SlotView } = await import('../src/ui/SlotView.tsx');
const { GameOver } = await import('../src/ui/GameOver.tsx');

beforeEach(() => {
  played.length = 0;
});

const slot = (damage: number): SlotViewData =>
  ({
    stack: [{ uid: 'u1', defId: 'me01-077', owner: 0 }],
    energy: [],
    tool: null,
    damage,
    conditions: { rotation: 'none', poisoned: false, burned: false },
  }) as unknown as SlotViewData;

test('a Pokémon in play shows an HP bar with its remaining HP', () => {
  render(<SlotView slot={slot(300)} />);
  const meter = screen.getByRole('meter', { name: 'HP' });
  expect(meter).toHaveAttribute('aria-valuenow', '40');
  expect(meter).toHaveAttribute('aria-valuemax', '340');
  expect(screen.getByText('40/340')).toBeInTheDocument();
});

test('winning against the bot plays the win jingle once', () => {
  const props = {
    result: { winner: 0, reason: 'prizes' } as const,
    mode: 'bot' as const,
    human: 0 as const,
    credits: 100,
    onAgain() {},
    onHome() {},
  };
  const { rerender } = render(<GameOver {...props} />);
  rerender(<GameOver {...props} />);
  expect(played).toEqual(['win']);
});

test('losing plays the lose jingle; hotseat plays nothing', () => {
  const base = { onAgain() {}, onHome() {}, human: 0 as const };
  const { unmount } = render(
    <GameOver {...base} result={{ winner: 1, reason: 'prizes' }} mode="bot" credits={30} />,
  );
  expect(played).toEqual(['lose']);
  unmount();
  render(<GameOver {...base} result={{ winner: 1, reason: 'prizes' }} mode="hotseat" credits={null} />);
  expect(played).toEqual(['lose']);
});
