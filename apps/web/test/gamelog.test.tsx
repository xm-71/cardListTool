import { render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { GameEvent } from '@ptcg/engine';
import { GameLog } from '../src/ui/GameLog.tsx';

const original = Element.prototype.scrollIntoView;
afterEach(() => {
  Element.prototype.scrollIntoView = original;
});

const ev = (text: string): GameEvent => ({ type: 'info', text }) as unknown as GameEvent;

test('the log keeps working when scrollIntoView returns a Promise (Chrome 154+ on Android)', () => {
  // Newer browsers return a Promise from scroll methods; React must not mistake it for an effect cleanup.
  Element.prototype.scrollIntoView = vi.fn(() => Promise.resolve()) as unknown as typeof original;
  const { rerender, unmount } = render(<GameLog log={[ev('one')]} me={0} />);
  expect(() => rerender(<GameLog log={[ev('one'), ev('two')]} me={0} />)).not.toThrow();
  expect(() => unmount()).not.toThrow();
  expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(2);
});
