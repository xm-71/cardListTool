import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { setCards } from '@ptcg/cards';

const played: string[] = [];
vi.mock('../src/audio/sfx.ts', () => ({ sfx: (name: string) => played.push(name), unlockAudio: () => {} }));

const { PackOpening } = await import('../src/ui/PackOpening.tsx');
const { rarityTier, TAG } = await import('../src/ui/pack/rarity.ts');

const all = [...setCards('me01'), ...setCards('me02')];
const byRarity = (r: string) => all.find((c) => c.rarity === r)!.id;
const commons = setCards('me01')
  .filter((c) => c.rarity === 'Common')
  .slice(0, 9)
  .map((c) => c.id);

beforeEach(() => {
  played.length = 0;
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const passIntro = () => act(() => vi.advanceTimersByTime(1100));

describe('rarityTier', () => {
  test('maps every rarity in the shop sets', () => {
    const expected: Record<string, string> = {
      Common: 'common',
      Uncommon: 'common',
      Rare: 'rare',
      'Double rare': 'ultra',
      'Ultra Rare': 'ultra',
      'Illustration rare': 'special',
      'Special illustration rare': 'special',
      'Mega Hyper Rare': 'special',
      'Holo Rare': 'ultra',
    };
    for (const r of new Set(all.map((c) => c.rarity))) expect(rarityTier(r), r).toBe(expected[r]);
    expect(rarityTier('Holo Rare')).toBe('ultra');
    expect(rarityTier('Something new')).toBe('common');
    expect(TAG.common('Common')).toBeNull();
    expect(TAG.special('Special illustration rare')).toBe('SPECIAL ILLUSTRATION RARE!');
  });
});

describe('PackOpening', () => {
  test('shakes and tears the pack, then reveals one card at a time', () => {
    render(<PackOpening setId="me01" cards={[...commons, byRarity('Rare')]} onDone={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: 'Pack opening' });
    expect(within(dialog).getByTestId('pack-art')).toBeInTheDocument();
    // only the set logo on the wrapper, no card faces yet
    expect(
      within(dialog)
        .queryAllByRole('img')
        .map((i) => i.getAttribute('alt')),
    ).toEqual(['Mega Evolution logo']);
    expect(played).toContain('shake');
    passIntro();
    expect(played).toContain('tear');
    expect(within(dialog).getByText('Card 0 of 10')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Next' }));
    expect(within(dialog).getByText('Card 1 of 10')).toBeInTheDocument();
    expect(within(dialog).getAllByRole('img')).toHaveLength(1);
    expect(played.filter((p) => p === 'flip')).toHaveLength(1);
  });

  test('a special rarity flashes the screen and shows its tag', () => {
    render(
      <PackOpening
        setId="me01"
        cards={[byRarity('Special illustration rare'), ...commons]}
        onDone={() => {}}
      />,
    );
    passIntro();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByTestId('flash')).toBeInTheDocument();
    expect(screen.getByText('SPECIAL ILLUSTRATION RARE!')).toBeInTheDocument();
    expect(played).toContain('special');
    act(() => vi.advanceTimersByTime(400));
    expect(screen.queryByTestId('flash')).not.toBeInTheDocument();
  });

  test('a common card has no tag or flash; Enter also flips', () => {
    render(<PackOpening setId="me01" cards={[...commons, byRarity('Rare')]} onDone={() => {}} />);
    passIntro();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Enter' });
    expect(screen.getByText('Card 1 of 10')).toBeInTheDocument();
    expect(screen.queryByTestId('flash')).not.toBeInTheDocument();
    expect(screen.queryByText(/RARE!/)).not.toBeInTheDocument();
  });

  test('Reveal all shows all 10 cards and Done closes', () => {
    const onDone = vi.fn();
    render(<PackOpening setId="me01" cards={[...commons, byRarity('Rare')]} onDone={onDone} />);
    passIntro();
    fireEvent.click(screen.getByRole('button', { name: 'Reveal all' }));
    expect(screen.getAllByRole('img')).toHaveLength(10);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onDone).toHaveBeenCalledOnce();
  });

  test('reduced motion skips the shake and tear', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q.includes('reduce'),
      addEventListener() {},
      removeEventListener() {},
    }));
    render(
      <PackOpening
        setId="me01"
        cards={[byRarity('Special illustration rare'), ...commons]}
        onDone={() => {}}
      />,
    );
    expect(screen.getByText('Card 0 of 10')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.queryByTestId('flash')).not.toBeInTheDocument();
  });

  test('(RF4) unmounting mid-animation leaves no pending updates', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { unmount } = render(
      <PackOpening setId="me01" cards={[...commons, byRarity('Rare')]} onDone={() => {}} />,
    );
    act(() => vi.advanceTimersByTime(200));
    unmount();
    act(() => vi.advanceTimersByTime(5000));
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
