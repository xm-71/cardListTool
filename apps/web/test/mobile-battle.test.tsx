import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { CardInstance, SlotView as SlotViewData } from '@ptcg/engine';
import { LONG_PRESS_MS } from '../src/ui/longPress.ts';
import { CardView } from '../src/ui/CardView.tsx';
import { CardZoom } from '../src/ui/CardZoom.tsx';
import { DiscardViewer } from '../src/ui/DiscardViewer.tsx';
import { SlotView } from '../src/ui/SlotView.tsx';
import { usePreview } from '../src/ui/preview.ts';
import { CardThumb } from '../src/ui/CardThumb.tsx';
import { registry } from '../src/game/catalog.ts';

const gastly: CardInstance = { uid: 'p0-c1', defId: 'me02-054', owner: 0 };
const dark: CardInstance = { uid: 'p0-c50', defId: 'mee-007', owner: 0 };
const psychic: CardInstance = { uid: 'p0-c51', defId: 'mee-005', owner: 0 };
const slot = (energy: CardInstance[] = []): SlotViewData => ({
  stack: [gastly],
  energy,
  tool: null,
  damage: 0,
  conditions: { rotation: 'none', poisoned: false, burned: false },
  enteredTurn: 0,
  evolvedTurn: null,
  abilityUses: {},
  abilityUsedTurn: {},
  cantAttackOnTurn: null,
  attackLocks: {},
  markers: [],
  becameActiveTurn: null,
});

beforeEach(() => {
  vi.useFakeTimers();
  usePreview.setState({ zoomed: null });
});
afterEach(() => vi.useRealTimers());

const pointer = (el: Element, type: string, x: number, y: number) =>
  fireEvent(el, new MouseEvent(type, { bubbles: true, clientX: x, clientY: y }));
const press = (el: Element, x = 10, y = 10) => pointer(el, 'pointerdown', x, y);

describe('long press opens the card full size', () => {
  test('holding a card for 450 ms opens it, and the click that ends the press does not act', () => {
    const onClick = vi.fn();
    render(
      <>
        <CardView card={gastly} onClick={onClick} />
        <CardZoom />
      </>,
    );
    const card = screen.getByRole('button');
    press(card);
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS + 10));
    const view = screen.getByRole('dialog', { name: 'Card view' });
    expect(within(view).getByRole('img', { name: 'Gastly' })).toHaveAttribute(
      'src',
      expect.stringContaining('/high.webp'),
    );
    fireEvent.pointerUp(card);
    fireEvent.click(card);
    expect(onClick).not.toHaveBeenCalled();
  });

  test('a quick tap still clicks and opens nothing', () => {
    const onClick = vi.fn();
    render(
      <>
        <CardView card={gastly} onClick={onClick} />
        <CardZoom />
      </>,
    );
    const card = screen.getByRole('button');
    press(card);
    act(() => vi.advanceTimersByTime(100));
    fireEvent.pointerUp(card);
    fireEvent.click(card);
    act(() => vi.advanceTimersByTime(1000));
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog', { name: 'Card view' })).toBeNull();
  });

  test('moving the finger (scrolling) cancels the long press', () => {
    render(
      <>
        <CardView card={gastly} onClick={() => {}} />
        <CardZoom />
      </>,
    );
    const card = screen.getByRole('button');
    press(card);
    pointer(card, 'pointermove', 10, 60);
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS + 10));
    expect(screen.queryByRole('dialog', { name: 'Card view' })).toBeNull();
  });

  test('a card that is not clickable (a pile, the hand of cards) can be long-pressed too; noPreview ones cannot', () => {
    const { unmount } = render(
      <>
        <CardView card={gastly} />
        <CardZoom />
      </>,
    );
    press(screen.getByRole('img', { name: 'Gastly' }));
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS + 10));
    expect(screen.getByRole('dialog', { name: 'Card view' })).toBeInTheDocument();
    unmount();
    usePreview.setState({ zoomed: null });
    render(
      <>
        <CardView card={gastly} noPreview />
        <CardZoom />
      </>,
    );
    press(screen.getByRole('img', { name: 'Gastly' }));
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS + 10));
    expect(screen.queryByRole('dialog', { name: 'Card view' })).toBeNull();
  });

  test('the context menu browsers open on a long touch is suppressed after a long press', () => {
    render(<CardView card={gastly} onClick={() => {}} />);
    const card = screen.getByRole('button');
    press(card);
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS + 10));
    const notPrevented = fireEvent.contextMenu(card);
    expect(notPrevented).toBe(false);
  });

  test('tapping the backdrop, Close or pressing Escape dismisses the card view', () => {
    render(<CardZoom />);
    const open = () => act(() => usePreview.getState().zoom(gastly));
    open();
    fireEvent.click(screen.getByRole('dialog', { name: 'Card view' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    open();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Energy cards show their art', () => {
  test('Energy attached to a Pokémon are small card pictures, one per card', () => {
    render(<SlotView slot={slot([dark, dark, psychic])} />);
    expect(screen.getAllByRole('img', { name: 'Darkness Energy' })).toHaveLength(2);
    expect(screen.getByRole('img', { name: 'Psychic Energy' })).toHaveAttribute(
      'src',
      expect.stringContaining('/low.webp'),
    );
  });

  test('an Energy picture that cannot load falls back to its coloured dot', () => {
    render(<SlotView slot={slot([dark])} />);
    fireEvent.error(screen.getByRole('img', { name: 'Darkness Energy' }));
    expect(screen.queryByRole('img', { name: 'Darkness Energy' })).toBeNull();
    expect(screen.getAllByTitle('Darkness Energy').length).toBeGreaterThan(0);
  });

  test('every Energy card in the game has art to show', () => {
    const energy = Object.values(registry.defs).filter((d) => d.category === 'Energy');
    expect(energy.length).toBeGreaterThan(0);
    for (const d of energy) expect(d.image, d.id).toMatch(/^https:\/\//);
  });

  test('list rows get a small picture that is decorative and disappears if it fails', () => {
    const def = registry.defs['mee-007']!;
    const { container } = render(<CardThumb def={def} />);
    const img = container.querySelector('img')!;
    expect(img).toHaveAttribute('alt', '');
    fireEvent.error(img);
    expect(container.querySelector('img')).toBeNull();
  });
});

describe('discard pile viewer', () => {
  test('lists every card with art, newest first, and closes', () => {
    const onClose = vi.fn();
    render(<DiscardViewer label="You" cards={[gastly, dark, psychic]} onClose={onClose} />);
    const view = screen.getByRole('dialog', { name: 'You discard pile' });
    const names = within(view)
      .getAllByRole('img')
      .map((i) => i.getAttribute('alt'));
    expect(names).toEqual(['Psychic Energy', 'Darkness Energy', 'Gastly']);
    fireEvent.click(within(view).getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });
});
