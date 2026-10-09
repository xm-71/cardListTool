import { render, screen, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import { ELITE, LEADERS } from '../src/game/gym.ts';
import { GRID, LOOKS, portraitGrid, portraitRuns } from '../src/game/portraits.ts';
import { CharacterPortrait } from '../src/ui/CharacterPortrait.tsx';
import { GymGameOver } from '../src/ui/GymGameOver.tsx';

const ids = [...LEADERS, ...ELITE].map((o) => o.id);

test('every gym leader, Elite Four member and the Champion has a portrait', () => {
  expect(Object.keys(LOOKS).sort()).toEqual([...ids].sort());
  expect(portraitGrid('nobody')).toBeNull();
});

test('each portrait is a full 24x24 picture with a decent range of colours', () => {
  for (const id of ids) {
    const grid = portraitGrid(id)!;
    expect(grid).toHaveLength(GRID);
    for (const row of grid) {
      expect(row).toHaveLength(GRID);
      expect(
        row.every((c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c)),
        id,
      ).toBe(true);
    }
    expect(new Set(grid.flat()).size, id).toBeGreaterThanOrEqual(7);
  }
});

test('no two characters look alike', () => {
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) {
      const a = portraitGrid(ids[i]!)!.flat();
      const b = portraitGrid(ids[j]!)!.flat();
      const different = a.filter((c, k) => c !== b[k]).length;
      expect(different, `${ids[i]} vs ${ids[j]}`).toBeGreaterThan(120);
    }
});

test('the runs rebuild the grid exactly', () => {
  const grid = portraitGrid('blaine')!;
  const rebuilt = grid.map((row) => row.map(() => null as string | null));
  for (const r of portraitRuns(grid)) for (let c = 0; c < r.len; c++) rebuilt[r.row]![r.col + c] = r.color;
  expect(rebuilt).toEqual(grid);
});

test('a named portrait is an image for screen readers; an unnamed one is decoration', () => {
  const { container } = render(
    <>
      <CharacterPortrait id="brock" name="Brock" />
      <CharacterPortrait id="misty" />
      <CharacterPortrait id="nobody" name="Nobody" />
    </>,
  );
  expect(screen.getByRole('img', { name: 'Brock' })).toBeInTheDocument();
  expect(screen.queryByRole('img', { name: 'Nobody' })).toBeNull();
  expect(container.querySelectorAll('svg')).toHaveLength(2);
  expect(container.querySelectorAll('svg')[1]).toHaveAttribute('aria-hidden', 'true');
});

test('the game over screen shows the opponent’s portrait', () => {
  render(
    <GymGameOver
      context={{ kind: 'gym', leaderId: 'koga', deck: { kind: 'starter', id: 'mega-gengar' } }}
      result={{ winner: 0, reason: 'prizes' }}
      human={0}
      payout={{ credits: 0, packs: [], badge: false, champion: false }}
      onBack={() => {}}
      onRematch={() => {}}
      onNext={() => {}}
    />,
  );
  const dialog = screen.getByRole('dialog', { name: 'Game over' });
  expect(within(dialog).getByRole('img', { name: 'Koga' })).toBeInTheDocument();
});
