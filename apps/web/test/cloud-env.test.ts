import { expect, test } from 'vitest';
import { cloudConfig } from '../src/cloud/config.ts';
test('tests never see account-service variables from a local .env file', () => {
  expect(cloudConfig()).toBeNull();
});
