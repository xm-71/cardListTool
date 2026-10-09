# Offline play (PWA) — design

**Goal:** install the game on Android and iOS and play with no connection.

- **Installable:** `manifest.webmanifest` (standalone, pixel Poké Ball icons incl. maskable and Apple touch icon) and Apple meta tags in `index.html`. Options shows how to install (iOS: Share → Add to Home Screen; Android: an Install button from `beforeinstallprompt`).
- **Service worker** (`sw.template.js`, emitted as `/sw.js` by a small Vite plugin that inlines the build's file list):
  - app shell: every built file is precached on install, so a first online visit is enough; navigation is network-first with the cached `index.html` as fallback; hashed assets are cache-first; old shell caches are removed on activate; no `skipWaiting`, so an open session never loses its files.
  - card art (`assets.tcgdex.net`): cached as seen, in a separate `art-v1` cache that survives app updates. Requests are re-made with CORS so stored responses are normal (not opaque) and cheap on quota. A missing image offline fails and the card shows its text version.
- **Download all art** (Options): fetches both image sizes of all 1,359 cards (about 55 MB) six at a time, with progress, Stop, and "Remove saved art"; asks the browser to keep the storage (`storage.persist`).
- The profile already lives in IndexedDB, so progress works offline.
- **Out of scope:** background sync, update prompts, push.
- **Tests:** `art.ts` unit tests with a fake Cache API, the Options section, and a Playwright test that reloads offline after one visit.
