import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { DialogBox, HpBar, Menu } from '../src/ui/retro/index.ts';

const items = [
  { id: 'duel', label: 'Duel' },
  { id: 'shop', label: 'Shop' },
  { id: 'binder', label: 'Binder' },
  { id: 'decks', label: 'Decks', disabled: true },
  { id: 'options', label: 'Options' },
];

describe('Menu', () => {
  test('arrow keys move the cursor and Enter selects', () => {
    const onSelect = vi.fn();
    render(<Menu label="Main menu" items={items} onSelect={onSelect} />);
    const menu = screen.getByRole('menu', { name: 'Main menu' });
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    fireEvent.keyDown(menu, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('binder');
  });

  test('ArrowUp from the first item wraps to the last, skipping disabled items', () => {
    const onSelect = vi.fn();
    render(<Menu label="Main menu" items={items} onSelect={onSelect} />);
    const menu = screen.getByRole('menu');
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    fireEvent.keyDown(menu, { key: ' ' });
    expect(onSelect).toHaveBeenLastCalledWith('options');
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    fireEvent.keyDown(menu, { key: 'Enter' });
    expect(onSelect).toHaveBeenLastCalledWith('shop');
  });

  test('the active item carries the cursor and clicking selects', () => {
    const onSelect = vi.fn();
    render(<Menu label="Main menu" items={items} onSelect={onSelect} initial="shop" />);
    expect(screen.getByRole('menuitem', { name: 'Shop' })).toHaveAttribute('data-active', 'true');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Duel' }));
    expect(onSelect).toHaveBeenCalledWith('duel');
  });

  test('(RF3) keys typed in an input outside the menu do not move the cursor', () => {
    const onSelect = vi.fn();
    render(
      <>
        <input aria-label="Name" />
        <Menu label="Main menu" items={items} onSelect={onSelect} />
      </>,
    );
    fireEvent.keyDown(screen.getByLabelText('Name'), { key: 'ArrowDown' });
    fireEvent.keyDown(screen.getByLabelText('Name'), { key: 'Enter' });
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole('menuitem', { name: 'Duel' })).toHaveAttribute('data-active', 'true');
  });
});

describe('DialogBox', () => {
  afterEach(() => vi.useRealTimers());

  test('types out, completes on click, then calls onDone once', () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(<DialogBox text="Hello there!" onDone={onDone} />);
    const box = screen.getByRole('button', { name: 'Hello there!' });
    expect(box).toHaveTextContent(/^$/);
    act(() => vi.advanceTimersByTime(75));
    expect(box.textContent).toMatch(/^Hel/);
    fireEvent.click(box);
    expect(box).toHaveTextContent('Hello there!');
    expect(onDone).not.toHaveBeenCalled();
    fireEvent.click(box);
    fireEvent.click(box);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  test('restarts when the text changes', () => {
    vi.useFakeTimers();
    const { rerender } = render(<DialogBox text="One" />);
    act(() => vi.advanceTimersByTime(1000));
    rerender(<DialogBox text="Two" />);
    expect(screen.getByRole('button', { name: 'Two' })).toHaveTextContent(/^$/);
  });
});

test('HpBar exposes the value and turns red when low', () => {
  render(<HpBar hp={50} max={340} />);
  const meter = screen.getByRole('meter');
  expect(meter).toHaveAttribute('aria-valuenow', '50');
  expect(meter).toHaveAttribute('aria-valuemax', '340');
  expect(meter).toHaveAttribute('data-level', 'low');
});
