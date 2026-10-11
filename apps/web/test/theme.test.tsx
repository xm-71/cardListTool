import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { Options } from '../src/screens/Options.tsx';
import { applyTheme, resolvedTheme } from '../src/settings/theme.ts';
import { useSettings } from '../src/settings/useSettings.ts';
import { createMemoryStore } from '../src/profile/memoryStore.ts';
import { newProfile } from '../src/profile/types.ts';
import { useProfile } from '../src/profile/useProfile.ts';

const css = readFileSync(join(import.meta.dirname, '../src/index.css'), 'utf8');

/** The `--c-*` colours declared in the block that starts with `selector {`. */
function tokens(selector: string): Record<string, string> {
  const at = css.indexOf(`${selector} {`);
  expect(at, `${selector} block`).toBeGreaterThanOrEqual(0);
  const body = css.slice(at, css.indexOf('}', at));
  return Object.fromEntries(
    [...body.matchAll(/--c-([a-z-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1]!, m[2]!]),
  );
}
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

const light = tokens(':root');
const dark = tokens(":root[data-theme='dark']");

describe('the colour tokens', () => {
  test('the system dark block says exactly what the explicit dark block says', () => {
    expect(tokens(":root:not([data-theme='light'])")).toEqual(dark);
  });

  test('dark mode redefines every surface and text colour of light mode', () => {
    for (const name of [
      'cream',
      'paper',
      'ink',
      'mat',
      'mat-dark',
      'shadow',
      'red-fg',
      'green-fg',
      'blue-fg',
      'purple-fg',
    ])
      expect(dark[name], name).toBeDefined();
    expect(dark.paper).not.toBe(light.paper);
    expect(dark.ink).not.toBe(light.ink);
  });

  test('dark: text on its surfaces is readable (4.5:1)', () => {
    for (const surface of ['paper', 'cream'] as const)
      for (const fg of ['ink', 'red-fg', 'green-fg', 'blue-fg', 'purple-fg'])
        expect(contrast(dark[fg]!, dark[surface]!), `${fg} on ${surface}`).toBeGreaterThanOrEqual(4.5);
  });

  test('dark: the dark page is darker than a panel, and the ink lighter than both', () => {
    expect(lum(dark.cream!)).toBeLessThan(lum(dark.paper!));
    expect(lum(dark.ink!)).toBeGreaterThan(lum(dark.paper!) * 4);
  });

  test('light mode keeps its colours', () => {
    expect(light).toMatchObject({ cream: '#f8f0d0', paper: '#fffbe8', ink: '#283040' });
    for (const fg of ['red-fg', 'green-fg', 'blue-fg', 'purple-fg'])
      expect(contrast(light[fg]!, light.paper!), fg).toBeGreaterThanOrEqual(3);
  });

  test('text on the bright accents is the same dark/light pair in both modes', () => {
    const fixed = { ink: '#283040', paper: '#fffbe8' };
    expect(contrast(fixed.ink, '#f0c030')).toBeGreaterThanOrEqual(4.5); // buttons on yellow
    for (const bg of ['#d84848', '#3868c0', '#58a050', '#8060c0'])
      expect(contrast(fixed.paper, bg), bg).toBeGreaterThanOrEqual(3);
  });
});

describe('applying the theme', () => {
  const root = document.documentElement;
  afterEach(() => {
    root.removeAttribute('data-theme');
    document.head.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
  });

  test('Dark and Light set data-theme; System removes it', () => {
    applyTheme('dark');
    expect(root.dataset.theme).toBe('dark');
    applyTheme('light');
    expect(root.dataset.theme).toBe('light');
    applyTheme('system');
    expect(root.dataset.theme).toBeUndefined();
  });

  test('the browser colour follows an explicit choice, and both schemes when it is System', () => {
    const colours = () =>
      [...document.head.querySelectorAll('meta[name="theme-color"]')].map((m) => [
        m.getAttribute('content'),
        m.getAttribute('media'),
      ]);
    applyTheme('dark');
    expect(colours()).toEqual([[dark.cream, null]]);
    applyTheme('light');
    expect(colours()).toEqual([[light.ink, null]]);
    applyTheme('system');
    expect(colours()).toEqual([
      [light.ink, '(prefers-color-scheme: light)'],
      [dark.cream, '(prefers-color-scheme: dark)'],
    ]);
  });

  test('resolvedTheme says which look is showing', () => {
    expect(resolvedTheme('dark', false)).toBe('dark');
    expect(resolvedTheme('light', true)).toBe('light');
    expect(resolvedTheme('system', true)).toBe('dark');
    expect(resolvedTheme('system', false)).toBe('light');
  });
});

describe('the theme setting', () => {
  beforeEach(() => {
    localStorage.clear();
    useSettings.setState({ theme: 'system' });
  });

  test('is System by default and is remembered when changed', () => {
    expect(useSettings.getState().theme).toBe('system');
    useSettings.getState().setTheme('dark');
    expect(JSON.parse(localStorage.getItem('ptcg.settings')!).theme).toBe('dark');
  });

  test('Options has Light, Dark and System, and choosing one applies it', async () => {
    useProfile.getState().reset();
    await useProfile.getState().init(createMemoryStore({ ...newProfile(), introDone: true }), true);
    render(<Options />);
    const group = screen.getByRole('radiogroup', { name: 'Theme' });
    expect(within(group).getByRole('radio', { name: 'System' })).toBeChecked();
    fireEvent.click(within(group).getByRole('radio', { name: 'Dark' }));
    expect(useSettings.getState().theme).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(within(group).getByRole('radio', { name: 'Dark' })).toBeChecked();
    fireEvent.click(within(group).getByRole('radio', { name: 'System' }));
    expect(document.documentElement.dataset.theme).toBeUndefined();
    document.documentElement.removeAttribute('data-theme');
  });
});
