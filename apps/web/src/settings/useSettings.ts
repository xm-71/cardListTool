import { create } from 'zustand';
import { applyTheme, isTheme, type Theme } from './theme.ts';

/** Per-browser conveniences (not part of the profile). */
export interface Settings {
  sound: boolean;
  /** Returning players open straight on the main menu. */
  skipTitle: boolean;
  /** Light, dark, or follow the device. */
  theme: Theme;
}

const KEY = 'ptcg.settings';
const DEFAULTS: Settings = { sound: true, skipTitle: false, theme: 'system' };

function read(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const saved = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULTS, ...saved, theme: isTheme(saved.theme) ? saved.theme : DEFAULTS.theme };
  } catch {
    return DEFAULTS;
  }
}

function write(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Storage unavailable: the setting just won't survive a reload.
  }
}

type Store = Settings & {
  setSound(on: boolean): void;
  setSkipTitle(on: boolean): void;
  setTheme(theme: Theme): void;
};

export const useSettings = create<Store>()((set, get) => {
  const update = (patch: Partial<Settings>) => {
    set(patch);
    const { sound, skipTitle, theme } = get();
    write({ sound, skipTitle, theme });
  };
  return {
    ...read(),
    setSound: (sound) => update({ sound }),
    setSkipTitle: (skipTitle) => update({ skipTitle }),
    setTheme: (theme) => {
      applyTheme(theme);
      update({ theme });
    },
  };
});
