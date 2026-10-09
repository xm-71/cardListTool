import { useEffect, useMemo, useRef, useState } from 'react';
import { registry } from '../game/catalog.ts';
import {
  artCacheSupported,
  artUrls,
  cachedArtCount,
  clearArt,
  downloadArt,
  keepArt,
} from '../offline/art.ts';
import { useInstall } from '../offline/useInstall.ts';
import { Button } from '../ui/retro/index.ts';

/** Every image is about 40 KB on average (a small and a large size per card). */
const APPROX_MB = (n: number) => Math.round((n * 40) / 1024);

/** Options: install the app on a phone and keep card art for offline play. */
export function OfflineSettings() {
  const urls = useMemo(() => artUrls(Object.values(registry.defs)), []);
  const install = useInstall();
  const [stored, setStored] = useState<number | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [message, setMessage] = useState('');
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    let live = true;
    void cachedArtCount(urls).then((n) => live && setStored(n));
    return () => {
      live = false;
    };
  }, [urls]);
  useEffect(() => () => abort.current?.abort(), []);

  const supported = artCacheSupported();
  const downloading = progress !== null;

  async function download() {
    abort.current = new AbortController();
    setMessage('');
    setProgress({ done: 0, total: urls.length });
    void keepArt();
    const result = await downloadArt(urls, {
      signal: abort.current.signal,
      onProgress: (done, total) => setProgress({ done, total }),
    });
    setProgress(null);
    setStored(await cachedArtCount(urls));
    setMessage(
      result.cancelled
        ? 'Download stopped. What was saved is kept.'
        : result.failed > 0
          ? `${result.failed} images could not be downloaded. Try again when you are online.`
          : 'All card art is saved for offline play.',
    );
  }

  async function remove() {
    await clearArt();
    setStored(0);
    setMessage('Saved card art removed.');
  }

  const complete = stored !== null && stored >= urls.length;
  return (
    <section aria-labelledby="offline-title" className="flex flex-col gap-3 border-t-4 border-ink pt-4">
      <h2 id="offline-title" className="font-pixel text-xs">
        Offline play
      </h2>
      <p className="text-lg">
        {install.installed
          ? 'Installed. The game runs without a connection; card art you have seen is saved automatically.'
          : 'Install the game on your phone to play offline. On iPhone or iPad, tap Share, then Add to Home Screen. On Android, use Install below or the browser menu.'}
      </p>
      {install.canInstall && (
        <Button className="self-start" onClick={() => void install.install()}>
          Install app
        </Button>
      )}
      {supported ? (
        <div className="flex flex-col gap-2">
          <p className="text-lg" aria-live="polite">
            {stored === null ? 'Checking saved art…' : `Card art saved: ${stored} of ${urls.length} images.`}
          </p>
          {downloading ? (
            <div className="flex flex-col gap-2">
              <progress
                aria-label="Download progress"
                className="h-4 w-full max-w-sm"
                value={progress.done}
                max={progress.total}
              />
              <p className="text-lg">
                Downloading {progress.done} of {progress.total}…
              </p>
              <Button variant="plain" className="self-start" onClick={() => abort.current?.abort()}>
                Stop
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              <Button disabled={complete} onClick={() => void download()}>
                Download all art
              </Button>
              <Button variant="plain" disabled={!stored} onClick={() => void remove()}>
                Remove saved art
              </Button>
            </div>
          )}
          <p className="text-lg">
            About {APPROX_MB(urls.length)} MB. Do this on Wi-Fi. Without it, card art you have not seen yet
            shows as text when offline.
          </p>
          {message && (
            <p role="status" className="text-lg">
              {message}
            </p>
          )}
        </div>
      ) : (
        <p className="text-lg">Saving card art is not available in this browser.</p>
      )}
    </section>
  );
}
