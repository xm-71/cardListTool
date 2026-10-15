import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { unlockAudio } from './audio/sfx.ts';
import { createFakeCloud } from './cloud/fakeApi.ts';
import { useCloud } from './cloud/useCloud.ts';
import { useGame } from './game/store.ts';
import { useProfile } from './profile/useProfile.ts';
import { registerServiceWorker } from './offline/register.ts';
import { applyTheme } from './settings/theme.ts';
import { useSettings } from './settings/useSettings.ts';
import '@fontsource/press-start-2p/400.css';
import '@fontsource/vt323/400.css';
import './index.css';

// Browsers only start audio after a user gesture.
for (const type of ['pointerdown', 'keydown'] as const) {
  window.addEventListener(type, unlockAudio, { once: true });
}

// Browser tests (?e2e) reach the game store to set up crowded boards quickly.
if (new URLSearchParams(location.search).has('e2e')) {
  (window as unknown as { __game: typeof useGame; __profile: typeof useProfile }).__game = useGame;
  (window as unknown as { __profile: typeof useProfile }).__profile = useProfile;
}

// With `?e2e&cloud=fake` the browser tests get an in-page account service they can seed and inspect.
if (
  new URLSearchParams(location.search).has('e2e') &&
  new URLSearchParams(location.search).get('cloud') === 'fake'
) {
  const fake = createFakeCloud();
  (window as unknown as { __cloudFake: typeof fake }).__cloudFake = fake;
  void useCloud.getState().init(fake.api);
}

applyTheme(useSettings.getState().theme);
registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
