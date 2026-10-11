import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const KEY = 'ptcg.settings';
let oscillators = 0;

class StubContext {
  currentTime = 0;
  state = 'running';
  destination = {};
  sampleRate = 8000;
  resume = vi.fn(() => Promise.resolve());
  createOscillator() {
    oscillators++;
    return {
      type: '',
      frequency: { setValueAtTime() {} },
      connect: (n: unknown) => n,
      start() {},
      stop() {},
    };
  }
  createGain() {
    const param = { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} };
    return { gain: param, connect: (n: unknown) => n };
  }
  createBuffer(_c: number, length: number) {
    return { getChannelData: () => new Float32Array(length) };
  }
  createBufferSource() {
    return { buffer: null, connect: (n: unknown) => n, start() {}, stop() {} };
  }
}

const load = async () => {
  vi.resetModules();
  return { ...(await import('../src/audio/sfx.ts')), ...(await import('../src/settings/useSettings.ts')) };
};

beforeEach(() => {
  oscillators = 0;
  localStorage.clear();
  vi.unstubAllGlobals();
});
afterEach(() => vi.unstubAllGlobals());

test('(RF2) without Web Audio, sfx does nothing and does not throw', async () => {
  vi.stubGlobal('AudioContext', undefined);
  const { sfx } = await load();
  expect(() => sfx('flip')).not.toThrow();
});

test('(RF2) an AudioContext that throws is swallowed silently', async () => {
  vi.stubGlobal(
    'AudioContext',
    class {
      constructor() {
        throw new Error('blocked');
      }
    },
  );
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const { sfx } = await load();
  expect(() => sfx('special')).not.toThrow();
  expect(error).not.toHaveBeenCalled();
  error.mockRestore();
});

test('sfx plays notes when sound is on and nothing when muted', async () => {
  vi.stubGlobal('AudioContext', StubContext);
  const { sfx, useSettings } = await load();
  sfx('flip');
  expect(oscillators).toBeGreaterThan(0);
  const before = oscillators;
  useSettings.getState().setSound(false);
  sfx('flip');
  sfx('tear');
  expect(oscillators).toBe(before);
});

test('the tear effect uses noise and does not throw', async () => {
  vi.stubGlobal('AudioContext', StubContext);
  const { sfx } = await load();
  expect(() => sfx('tear')).not.toThrow();
});

test('the sound setting persists across reloads', async () => {
  const first = await load();
  expect(first.useSettings.getState().sound).toBe(true);
  first.useSettings.getState().setSound(false);
  expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ sound: false, skipTitle: false, theme: 'system' });
  const second = await load();
  expect(second.useSettings.getState().sound).toBe(false);
});

test('a localStorage that throws falls back to the defaults', async () => {
  const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('denied');
  });
  const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('denied');
  });
  const { useSettings } = await load();
  expect(useSettings.getState().sound).toBe(true);
  expect(() => useSettings.getState().setSound(false)).not.toThrow();
  expect(useSettings.getState().sound).toBe(false);
  get.mockRestore();
  set.mockRestore();
});

test('unlockAudio resumes a suspended context', async () => {
  vi.stubGlobal('AudioContext', StubContext);
  const { unlockAudio, sfx } = await load();
  sfx('cursor');
  expect(() => unlockAudio()).not.toThrow();
});
