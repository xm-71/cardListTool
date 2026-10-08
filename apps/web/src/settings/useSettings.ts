import { create } from 'zustand';

/** Per-browser conveniences (not part of the profile). */
export interface Settings {
  sound: boolean;
}

const KEY = 'ptcg.settings';
const DEFAULTS: Settings = { sound: true };

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

export const useSettings = create<Settings & { setSound(on: boolean): void }>()((set) => ({
  ...read(),
  setSound(sound) {
    set({ sound });
    write({ sound });
  },
}));
