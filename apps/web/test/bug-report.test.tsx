import { render } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { bugReport } from '../src/ui/ErrorScreen.tsx';
import { ErrorBoundary } from '../src/ui/ErrorScreen.tsx';
import { deckById } from '../src/game/catalog.ts';
import { useGame } from '../src/game/store.ts';

const cfg = {
  mode: 'bot' as const,
  humanDeck: deckById('mega-gengar').list,
  botDeck: deckById('mega-diancie').list,
  seed: 7,
};

beforeEach(() => useGame.getState().reset());

test('an engine crash records the failing move, the stack and the device', () => {
  useGame.getState().start(cfg);
  const s = useGame.getState().state!;
  // corrupt the paused effect so replaying it throws a TypeError
  useGame.setState({
    state: { ...s, pending: { ...s.pending!, snapshot: { ...s.pending!.snapshot, players: [] as never } } },
  });
  const failing = { type: 'answer', optionId: s.prompt!.options[0]!.id } as const;
  useGame.getState().dispatch(s.prompt!.player, failing);
  const report = bugReport();
  expect(report.error).toMatch(/TypeError/);
  expect(report.failed).toEqual({
    source: 'engine',
    player: s.prompt!.player,
    action: failing,
    stack: expect.stringMatching(/at /),
  });
  expect(report.device).toMatchObject({ userAgent: navigator.userAgent, viewport: expect.any(String) });
  expect(report.build).toEqual(expect.any(String));
});

test('a rendering crash records the component stack', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const Boom = () => {
    throw new TypeError('w is not a function');
  };
  render(
    <ErrorBoundary>
      <Boom />
    </ErrorBoundary>,
  );
  const report = bugReport();
  expect(report.error).toBe('TypeError: w is not a function');
  expect(report.failed).toMatchObject({ source: 'render', stack: expect.stringMatching(/Boom/) });
});
