import { create } from 'zustand';

/** Per-browser conveniences (not part of the profile). */
export interface Settings {
  sound: boolean;
  /** Returning players open straight on the main menu. */
  skipTitle: boolean;
}

const KEY = 'ptcg.settings';
const DEFAULTS: Settings = { sound: true, skipTitle: false };

function read(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) } : DEFAULTS;
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

type Store = Settings & { setSound(on: boolean): void; setSkipTitle(on: boolean): void };

export const useSettings = create<Store>()((set, get) => {
  const update = (patch: Partial<Settings>) => {
    set(patch);
    const { sound, skipTitle } = get();
    write({ sound, skipTitle });
  };
  return {
    ...read(),
    setSound: (sound) => update({ sound }),
    setSkipTitle: (skipTitle) => update({ skipTitle }),
  };
});
