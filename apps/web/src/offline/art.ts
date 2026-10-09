/** Card art for offline use. The service worker caches art as it is seen; this downloads the rest ahead of time. */
export const ART_CACHE = 'art-v1';

/** Both image sizes the app shows (the small one in lists and hands, the large one in zoom). */
export function artUrls(defs: Iterable<{ image?: string | null }>): string[] {
  const urls: string[] = [];
  for (const d of defs) {
    if (!d.image) continue;
    urls.push(`${d.image}/low.webp`, `${d.image}/high.webp`);
  }
  return urls;
}

export const artCacheSupported = (): boolean => typeof caches !== 'undefined';

/** How many of `urls` are already stored. */
export async function cachedArtCount(urls: readonly string[]): Promise<number> {
  if (!artCacheSupported()) return 0;
  const wanted = new Set(urls);
  const cache = await caches.open(ART_CACHE);
  let n = 0;
  for (const request of await cache.keys()) if (wanted.has(request.url)) n++;
  return n;
}

export interface DownloadResult {
  /** Images stored (including ones that were already there). */
  stored: number;
  failed: number;
  cancelled: boolean;
}

/** Fetch every image not yet stored, a few at a time. Stops early when `signal` aborts. */
export async function downloadArt(
  urls: readonly string[],
  o: { onProgress?: (done: number, total: number) => void; signal?: AbortSignal; concurrency?: number } = {},
): Promise<DownloadResult> {
  const cache = await caches.open(ART_CACHE);
  let next = 0;
  let done = 0;
  let stored = 0;
  let failed = 0;
  const worker = async () => {
    while (next < urls.length && !o.signal?.aborted) {
      const url = urls[next++]!;
      try {
        if (await cache.match(url)) stored++;
        else {
          const response = await fetch(url, { mode: 'cors', signal: o.signal });
          if (!response.ok) throw new Error(String(response.status));
          await cache.put(url, response);
          stored++;
        }
      } catch {
        if (!o.signal?.aborted) failed++;
      }
      done++;
      o.onProgress?.(done, urls.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(o.concurrency ?? 6, urls.length) }, worker));
  return { stored, failed, cancelled: !!o.signal?.aborted };
}

export async function clearArt(): Promise<void> {
  if (artCacheSupported()) await caches.delete(ART_CACHE);
}

/** Ask the browser not to evict the stored art when space runs low (best effort). */
export async function keepArt(): Promise<void> {
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* ignore */
  }
}
