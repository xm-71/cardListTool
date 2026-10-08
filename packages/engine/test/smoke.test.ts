import { expect, test } from 'vitest';
import { ENGINE_VERSION } from '../src/index.ts';

test('engine exposes its version', () => {
  expect(ENGINE_VERSION).toBe('0.1.0');
});
