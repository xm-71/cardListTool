import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ART_CACHE, artUrls, cachedArtCount, clearArt, downloadArt } from '../src/offline/art.ts';
import { OfflineSettings } from '../src/screens/OfflineSettings.tsx';

/** A tiny in-memory CacheStorage, enough for the art cache. */
function fakeCaches() {
  const stores = new Map<string, Map<string, Response>>();
  const open = async (name: string) => {
    const m = stores.get(name) ?? new Map<string, Response>();
    stores.set(name, m);
    return {
      match: async (u: string) => m.get(u),
      put: async (u: string, r: Response) => void m.set(u, r),
      keys: async () => [...m.keys()].map((url) => ({ url }) as Request),
    };
  };
  return { stores, caches: { open, delete: async (n: string) => stores.delete(n) } };
}

let fake = fakeCaches();
beforeEach(() => {
  fake = fakeCaches();
  vi.stubGlobal('caches', fake.caches);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => new Response('img', { status: url.includes('bad') ? 404 : 200 })),
  );
});
afterEach(() => vi.unstubAllGlobals());

test('artUrls lists the small and large image of each card, skipping cards without art', () => {
  expect(artUrls([{ image: 'https://x/a' }, { image: null }, {}])).toEqual([
    'https://x/a/low.webp',
    'https://x/a/high.webp',
  ]);
});

test('downloadArt stores every image, reports progress, and skips ones already stored', async () => {
  const urls = ['https://x/1/low.webp', 'https://x/1/high.webp', 'https://x/2/low.webp'];
  const cache = await fake.caches.open(ART_CACHE);
  await cache.put(urls[0]!, new Response('old'));
  const progress: number[] = [];
  const result = await downloadArt(urls, { onProgress: (d) => progress.push(d), concurrency: 2 });
  expect(result).toEqual({ stored: 3, failed: 0, cancelled: false });
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(progress.at(-1)).toBe(3);
  expect(await cachedArtCount(urls)).toBe(3);
});

test('downloadArt counts failures and can be stopped', async () => {
  const result = await downloadArt(['https://x/bad/low.webp', 'https://x/ok/low.webp']);
  expect(result).toMatchObject({ stored: 1, failed: 1 });
  const ac = new AbortController();
  ac.abort();
  expect(await downloadArt(['https://x/ok/high.webp'], { signal: ac.signal })).toMatchObject({
    cancelled: true,
    stored: 0,
  });
});

test('clearArt removes the stored art', async () => {
  await downloadArt(['https://x/ok/low.webp']);
  await clearArt();
  expect(await cachedArtCount(['https://x/ok/low.webp'])).toBe(0);
});

test('Options offers Download all art and shows how much is saved', async () => {
  render(<OfflineSettings />);
  expect(await screen.findByText(/Card art saved: 0 of/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Download all art' }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('All card art is saved'), {
    timeout: 20000,
  });
  expect(screen.getByRole('button', { name: 'Download all art' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Remove saved art' }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('removed'));
  expect(screen.getByText(/Card art saved: 0 of/)).toBeInTheDocument();
}, 30000);

test('Options explains how to install on iPhone and Android', async () => {
  render(<OfflineSettings />);
  expect(await screen.findByText(/Add to Home Screen/)).toBeInTheDocument();
});

test('without the Cache API the section says art saving is unavailable', async () => {
  vi.stubGlobal('caches', undefined);
  render(<OfflineSettings />);
  expect(await screen.findByText(/not available in this browser/)).toBeInTheDocument();
});
