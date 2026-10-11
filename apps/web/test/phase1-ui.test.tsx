import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { PACKS } from '@ptcg/economy';
import { GameMenu } from '../src/ui/GameMenu.tsx';
import { Sheet } from '../src/ui/Sheet.tsx';
import { useIsPhone } from '../src/ui/useIsPhone.ts';
import { PackArt } from '../src/ui/pack/PackArt.tsx';
import { Shop } from '../src/screens/Shop.tsx';
import { useGame } from '../src/game/store.ts';
import { createMemoryStore } from '../src/profile/memoryStore.ts';
import { newProfile, type Profile } from '../src/profile/types.ts';
import { useProfile } from '../src/profile/useProfile.ts';

afterEach(() => vi.unstubAllGlobals());

describe('useIsPhone', () => {
  test('follows the (max-width: 1023px) media query and its changes', () => {
    let listener: (() => void) | undefined;
    const mql = {
      matches: true,
      addEventListener: (_: string, l: () => void) => (listener = l),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal('matchMedia', (q: string) => {
      expect(q).toBe('(max-width: 1023px)');
      return mql;
    });
    const { result } = renderHook(() => useIsPhone());
    expect(result.current).toBe(true);
    mql.matches = false;
    act(() => listener!());
    expect(result.current).toBe(false);
  });

  test('is false when matchMedia is missing', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(renderHook(() => useIsPhone()).result.current).toBe(false);
  });
});

describe('Sheet', () => {
  test('is a dialog with a title that closes with ×, Escape and the backdrop', () => {
    const onClose = vi.fn();
    render(
      <Sheet title="Game menu" onClose={onClose}>
        <p>content</p>
      </Sheet>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Game menu' });
    expect(within(dialog).getByText('content')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByTestId('sheet-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(3);
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});

describe('GameMenu', () => {
  const setup = (over: Partial<Parameters<typeof GameMenu>[0]> = {}) => {
    const props = {
      onConcede: vi.fn(),
      onQuit: vi.fn(),
      log: <section aria-label="Game log">entries</section>,
      ...over,
    };
    render(<GameMenu {...props} />);
    return props;
  };

  test('Menu opens a Game menu sheet with the log, Concede and Quit to home', () => {
    const p = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    const sheet = screen.getByRole('dialog', { name: 'Game menu' });
    expect(within(sheet).queryByRole('region', { name: 'Game log' })).toBeNull();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Show log' }));
    expect(within(sheet).getByRole('region', { name: 'Game log' })).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Hide log' }));
    expect(within(sheet).queryByRole('region', { name: 'Game log' })).toBeNull();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Concede' }));
    expect(p.onConcede).toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Game menu' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Game menu' })).getByRole('button', { name: 'Quit to home' }),
    );
    expect(p.onQuit).toHaveBeenCalled();
  });

  test('Concede is missing from the menu when it is not legal', () => {
    setup({ onConcede: undefined });
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.queryByRole('button', { name: 'Concede' })).toBeNull();
  });
});

describe('PackArt size', () => {
  test('sm is smaller than md', () => {
    const { rerender } = render(<PackArt setId="base1" name="Base Set" />);
    expect(screen.getByTestId('pack-art')).toHaveAttribute('data-size', 'md');
    rerender(<PackArt setId="base1" name="Base Set" size="sm" />);
    expect(screen.getByTestId('pack-art')).toHaveAttribute('data-size', 'sm');
    expect(screen.getByTestId('pack-art').className).toContain('w-20');
  });
});

describe('the Shop on a small screen', () => {
  async function shop(p: Partial<Profile> = {}) {
    useGame.getState().reset();
    useProfile.getState().reset();
    await useProfile.getState().init(createMemoryStore({ ...newProfile(), ...p }), true);
    render(<Shop />);
  }
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q.includes('max-width'),
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
  });

  test('has no intro box; Collector mode gets a one-line note', async () => {
    await shop();
    expect(screen.queryByText(/Win games against the bots/)).toBeNull();
    expect(screen.queryByText(/every pack is free/)).toBeNull();
  });

  test('Collector mode says every pack is free', async () => {
    await shop({ collectorMode: true });
    expect(screen.getByText(/every pack is free/i)).toBeInTheDocument();
  });

  test('era chips keep their full names for screen readers and shorten them on screen', async () => {
    await shop();
    const filter = screen.getByRole('group', { name: 'Filter packs' });
    const chip = within(filter).getByRole('button', { name: 'Mega Evolution era' });
    expect(chip).toHaveTextContent('Mega');
    expect(within(filter).getByRole('button', { name: 'HeartGold SoulSilver' })).toHaveTextContent('HGSS');
    expect(within(filter).getByRole('button', { name: 'Diamond & Pearl' })).toHaveTextContent('D&P');
    expect(within(filter).getByRole('button', { name: 'Scarlet & Violet' })).toHaveTextContent('S&V');
  });

  test('a Search button opens the search box', async () => {
    await shop();
    const box = screen.getByRole('searchbox', { name: 'Search packs' });
    expect(box.parentElement).toHaveClass('hidden');
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(box.parentElement).not.toHaveClass('hidden');
  });

  test('pack rows use the mini pack art', async () => {
    await shop();
    for (const art of screen.getAllByTestId('pack-art')) expect(art).toHaveAttribute('data-size', 'mini');
    expect(screen.getAllByRole('button', { name: 'Buy & open' })).toHaveLength(PACKS.length);
  });
});
