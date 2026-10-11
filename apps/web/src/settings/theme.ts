export type Theme = 'system' | 'light' | 'dark';
export const THEMES: readonly Theme[] = ['system', 'light', 'dark'];

/** The browser/phone chrome colour for each look (the page colours live in index.css). */
const CHROME = { light: '#283040', dark: '#141a28' } as const;

export const isTheme = (x: unknown): x is Theme => THEMES.includes(x as Theme);

/** Which look is showing: the chosen one, or the device's when the choice is System. */
export function resolvedTheme(theme: Theme, systemPrefersDark: boolean): 'light' | 'dark' {
  return theme === 'system' ? (systemPrefersDark ? 'dark' : 'light') : theme;
}

function setChrome(theme: Theme): void {
  document.head.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
  const add = (content: string, media?: string) => {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = content;
    if (media) meta.setAttribute('media', media);
    document.head.append(meta);
  };
  if (theme === 'system') {
    add(CHROME.light, '(prefers-color-scheme: light)');
    add(CHROME.dark, '(prefers-color-scheme: dark)');
  } else add(CHROME[theme]);
}

/** Shows the theme: sets `data-theme` on the page (System leaves it off so the device decides) and the browser colour. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
  setChrome(theme);
}
