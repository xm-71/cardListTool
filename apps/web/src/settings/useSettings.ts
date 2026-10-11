import { create } from 'zustand';
import { applyTheme, isTheme, type Theme } from './theme.ts';

/** Per-browser conveniences (not part of the profile). */
export interface Settings {
  sound: boolean;
  /** Returning players open straight on the main menu. */
  skipTitle: boolean;
  /** Light, dark, or follow the device. */
  theme: Theme;
  /** How battle animations play. */
  animations: AnimationSpeed;
}

export type AnimationSpeed = 'normal' | 'fast' | 'off';
export const ANIMATION_SPEEDS: readonly AnimationSpeed[] = ['normal', 'fast', 'off'];
const isSpeed = (x: unknown): x is AnimationSpeed => ANIMATION_SPEEDS.includes(x as AnimationSpeed);

/** Animations start Off on devices set to reduce motion, else Normal. */
export const animationDefault = (reduceMotion: boolean): AnimationSpeed => (reduceMotion ? 'off' : 'normal');
const reducedMotion = (): boolean =>
  typeof matchMedia === 'function' && !!matchMedia('(prefers-reduced-motion: reduce)')?.matches;

const KEY = 'ptcg.settings';
const DEFAULTS: Settings = { sound: true, skipTitle: false, theme: 'system', animations: 'normal' };

function read(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    const saved = (raw ? JSON.parse(raw) : {}) as Partial<Settings>;
    return {
      ...DEFAULTS,
      ...saved,
      theme: isTheme(saved.theme) ? saved.theme : DEFAULTS.theme,
      animations: isSpeed(saved.animations) ? saved.animations : animationDefault(reducedMotion()),
    };
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
  setAnimations(animations: AnimationSpeed): void;
};

export const useSettings = create<Store>()((set, get) => {
  const update = (patch: Partial<Settings>) => {
    set(patch);
    const { sound, skipTitle, theme, animations } = get();
    write({ sound, skipTitle, theme, animations });
  };
  return {
    ...read(),
    setSound: (sound) => update({ sound }),
    setSkipTitle: (skipTitle) => update({ skipTitle }),
    setAnimations: (animations) => update({ animations }),
    setTheme: (theme) => {
      applyTheme(theme);
      update({ theme });
    },
  };
});
