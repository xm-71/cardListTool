import { useEffect, useMemo, useRef, useState } from 'react';
import { registry } from '../game/catalog.ts';
import { artCacheSupported, artUrls, cachedArtUrls, clearArt, downloadArt, keepArt } from '../offline/art.ts';
import { eraArt } from '../offline/eraArt.ts';
import { useInstall } from '../offline/useInstall.ts';
import { Button } from '../ui/retro/index.ts';

/** Every image is about 40 KB on average (a small and a large size per card). */
const APPROX_MB = (n: number) => Math.round((n * 40) / 1024);

/** Options: install the app on a phone and keep card art for offline play. */
export function OfflineSettings() {
  const urls = useMemo(() => artUrls(Object.values(registry.defs)), []);
  const groups = useMemo(() => eraArt(), []);
  const install = useInstall();
  const [saved, setSaved] = useState<Set<string> | null>(null);
  const count = (list: readonly string[]) => (saved ? list.filter((u) => saved.has(u)).length : 0);
  const stored = saved ? count(urls) : null;
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [message, setMessage] = useState('');
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    let live = true;
    void cachedArtUrls().then((s) => live && setSaved(s));
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => () => abort.current?.abort(), []);

  const supported = artCacheSupported();
  const downloading = progress !== null;

  async function download(wanted: readonly string[], what: string) {
    abort.current = new AbortController();
    setMessage('');
    setProgress({ done: 0, total: wanted.length });
    void keepArt();
    const result = await downloadArt(wanted, {
      signal: abort.current.signal,
      onProgress: (done, total) => setProgress({ done, total }),
    });
    setProgress(null);
    setSaved(await cachedArtUrls());
    setMessage(
      result.cancelled
        ? 'Download stopped. What was saved is kept.'
        : result.failed > 0
          ? `${result.failed} images could not be downloaded. Try again when you are online.`
          : `${what} saved for offline play.`,
    );
  }

  async function remove() {
    await clearArt();
    setSaved(new Set());
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
              <Button disabled={complete} onClick={() => void download(urls, 'All card art is')}>
                Download all art
              </Button>
              <Button variant="plain" disabled={!stored} onClick={() => void remove()}>
                Remove saved art
              </Button>
            </div>
          )}
          {!downloading && (
            <ul aria-label="Card art by era" className="flex flex-col gap-2">
              {groups.map((g) => {
                const have = count(g.urls);
                return (
                  <li key={g.id} className="flex flex-wrap items-center gap-3 text-lg">
                    <span className="min-w-60">
                      {g.label}: {have} of {g.urls.length} images saved
                      <span className="opacity-60"> (about {APPROX_MB(g.urls.length)} MB)</span>
                    </span>
                    <Button
                      variant="plain"
                      disabled={saved === null || have >= g.urls.length}
                      onClick={() => void download(g.urls, `${g.label} art is`)}
                    >
                      Download {g.label} art
                    </Button>
                  </li>
                );
              })}
            </ul>
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
