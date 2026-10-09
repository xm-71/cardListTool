/**
 * Pixel-art character portraits for Gym Challenge. Each character is a small look (colours, hair, eyes, clothes)
 * that is drawn onto a 24x24 grid of colours, so every portrait is original art made in the same pixel style as the UI.
 */
export const GRID = 24;
export type Cell = string | null;
export type Grid = Cell[][];

type Hair = 'spiky' | 'flat' | 'bob' | 'long' | 'ponytail' | 'bun' | 'slick' | 'bald' | 'hood' | 'tall';
type Eyes = 'dot' | 'squint' | 'glasses' | 'shades' | 'bright' | 'slit';
type Mouth = 'smile' | 'flat' | 'smirk' | 'frown';
type TopStyle = 'shirt' | 'vest' | 'jacket' | 'kimono' | 'suit' | 'robe' | 'cape' | 'gi' | 'dress';
type Extra = 'beard' | 'hairpin' | 'mask' | 'lashes' | 'necklace' | 'cane';

export interface Look {
  /** Backdrop colour, from the character's type. */
  bg: string;
  skin: string;
  hair: string;
  hairStyle: Hair;
  eyes: Eyes;
  eyeColor?: string;
  mouth: Mouth;
  top: string;
  /** Collar, vest, sash and other clothing details. */
  trim: string;
  /** A third colour: hair ties, pins, necklaces. */
  accent?: string;
  topStyle: TopStyle;
  broad?: boolean;
  extras?: Extra[];
}

const INK = '#283040';
const PAPER = '#fffbe8';
const GLINT = '#ffffff';

/** A slightly darker shade of a #rrggbb colour. */
function shade(hex: string, amount = 0.82): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) =>
    Math.round(((n >> shift) & 255) * amount)
      .toString(16)
      .padStart(2, '0');
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}

/** The 13 characters: 8 gym leaders, the Elite Four and the Champion. */
export const LOOKS: Record<string, Look> = {
  brock: {
    bg: '#b88a52',
    skin: '#d9a066',
    hair: '#5a3a22',
    hairStyle: 'spiky',
    eyes: 'squint',
    mouth: 'flat',
    top: '#e8913a',
    trim: '#4f8a3c',
    topStyle: 'vest',
  },
  misty: {
    bg: '#68b0e8',
    skin: '#f3c9a0',
    hair: '#e8742a',
    hairStyle: 'ponytail',
    eyes: 'bright',
    eyeColor: '#2a8ac8',
    mouth: 'smile',
    top: '#f4d03a',
    trim: '#d84848',
    accent: '#d84848',
    topStyle: 'shirt',
  },
  surge: {
    bg: '#f0c85a',
    skin: '#e0a878',
    hair: '#f2d24a',
    hairStyle: 'tall',
    eyes: 'shades',
    mouth: 'smirk',
    top: '#5f7a3c',
    trim: '#3e5226',
    accent: '#c8c8d0',
    topStyle: 'jacket',
    extras: ['necklace'],
    broad: true,
  },
  erika: {
    bg: '#74b868',
    skin: '#f6d8b8',
    hair: '#2c2230',
    hairStyle: 'bob',
    eyes: 'squint',
    mouth: 'smile',
    top: '#e8607a',
    trim: '#fff0d8',
    accent: '#f6a8c8',
    topStyle: 'kimono',
    extras: ['hairpin'],
  },
  koga: {
    bg: '#7a5a9a',
    skin: '#d8b090',
    hair: '#4a3a78',
    hairStyle: 'hood',
    eyes: 'slit',
    mouth: 'flat',
    top: '#4a3a78',
    trim: '#8a78b8',
    accent: '#b8a8e0',
    topStyle: 'shirt',
    extras: ['mask'],
  },
  sabrina: {
    bg: '#c878b0',
    skin: '#f6e0d0',
    hair: '#201828',
    hairStyle: 'long',
    eyes: 'bright',
    eyeColor: '#b060f0',
    mouth: 'flat',
    top: '#a060c8',
    trim: '#f4eaff',
    accent: '#d84868',
    topStyle: 'dress',
    extras: ['lashes'],
  },
  blaine: {
    bg: '#e0604a',
    skin: '#e8b890',
    hair: '#f0eaea',
    hairStyle: 'bald',
    eyes: 'glasses',
    mouth: 'flat',
    top: '#e8832a',
    trim: '#fff6e0',
    topStyle: 'shirt',
    extras: ['beard'],
  },
  giovanni: {
    bg: '#6a5444',
    skin: '#d8a880',
    hair: '#241a1a',
    hairStyle: 'slick',
    eyes: 'dot',
    mouth: 'frown',
    top: '#463a3a',
    trim: '#c83838',
    topStyle: 'suit',
    broad: true,
  },
  lorelei: {
    bg: '#9ad8ec',
    skin: '#f6dccc',
    hair: '#b08ad8',
    hairStyle: 'bob',
    eyes: 'glasses',
    mouth: 'smile',
    top: '#5aa0e0',
    trim: '#e8f6ff',
    topStyle: 'dress',
  },
  bruno: {
    bg: '#b88a52',
    skin: '#d49866',
    hair: '#26262e',
    hairStyle: 'flat',
    eyes: 'squint',
    mouth: 'frown',
    top: '#f0f0e8',
    trim: '#282830',
    topStyle: 'gi',
    broad: true,
  },
  agatha: {
    bg: '#8a68aa',
    skin: '#eadccc',
    hair: '#d8d4e4',
    hairStyle: 'bun',
    eyes: 'squint',
    mouth: 'smirk',
    top: '#7a3a90',
    trim: '#d8b0f0',
    topStyle: 'robe',
    extras: ['cane'],
  },
  lance: {
    bg: '#5a88d8',
    skin: '#e8b890',
    hair: '#d8402c',
    hairStyle: 'spiky',
    eyes: 'dot',
    mouth: 'smirk',
    top: '#2c2c48',
    trim: '#e8742a',
    topStyle: 'cape',
    broad: true,
  },
  champion: {
    bg: '#9078d0',
    skin: '#e8bc94',
    hair: '#8a5a32',
    hairStyle: 'spiky',
    eyes: 'dot',
    mouth: 'smirk',
    top: '#3a2e58',
    trim: '#f0f0f0',
    accent: '#f0c030',
    topStyle: 'shirt',
    extras: ['necklace'],
  },
};

function blank(bg: string): Grid {
  return Array.from({ length: GRID }, () => Array<Cell>(GRID).fill(bg));
}

/** Sets cells on `row` for each column range, e.g. `fill(g, 5, [6, 17])`. */
function fill(g: Grid, row: number, color: string, ...ranges: [number, number][]): void {
  if (row < 0 || row >= GRID) return;
  for (const [from, to] of ranges) for (let c = from; c <= to; c++) g[row]![c] = color;
}
const px = (g: Grid, row: number, col: number, color: string): void => {
  if (row >= 0 && row < GRID && col >= 0 && col < GRID) g[row]![col] = color;
};

function drawTorso(g: Grid, l: Look): void {
  const w = l.broad ? 2 : 0;
  if (l.topStyle === 'cape') {
    // The cape billows out behind the shoulders.
    for (let r = 12; r <= 23; r++) fill(g, r, l.trim, [Math.max(0, 1 - (r - 12 > 3 ? 1 : 0)), 22]);
    for (let r = 12; r <= 23; r++) fill(g, r, shade(l.trim, 0.7), [0, 1], [22, 23]);
  }
  fill(g, 17, l.top, [7 - w, 16 + w]);
  fill(g, 18, l.top, [5 - w, 18 + w]);
  for (let r = 19; r <= 23; r++) fill(g, r, l.top, [3 - w, 20 + w]);
  const dark = shade(l.top, 0.78);
  switch (l.topStyle) {
    case 'shirt':
      fill(g, 17, l.trim, [9, 10], [13, 14]);
      fill(g, 18, l.trim, [10, 10], [13, 13]);
      for (let r = 19; r <= 23; r++) px(g, r, 4, dark);
      break;
    case 'vest':
      for (let r = 18; r <= 23; r++) fill(g, r, l.trim, [3, 6], [17, 20]);
      fill(g, 17, l.trim, [8, 9], [14, 15]);
      break;
    case 'jacket':
      fill(g, 17, l.trim, [7 - w, 10], [13, 16 + w]);
      for (let r = 18; r <= 23; r++) fill(g, r, dark, [11, 12]);
      fill(g, 20, l.trim, [4, 7], [16, 19]);
      break;
    case 'kimono':
      for (let r = 17; r <= 23; r++) {
        px(g, r, 9 + Math.floor((r - 17) / 2), l.trim);
        px(g, r, 14 - Math.floor((r - 17) / 2), l.trim);
        px(g, r, 10 + Math.floor((r - 17) / 2), l.trim);
        px(g, r, 13 - Math.floor((r - 17) / 2), l.trim);
      }
      fill(g, 21, l.accent ?? l.trim, [3, 20]);
      fill(g, 22, l.accent ?? l.trim, [3, 20]);
      break;
    case 'suit':
      fill(g, 17, PAPER, [10, 13]);
      fill(g, 18, PAPER, [10, 13]);
      fill(g, 19, PAPER, [11, 12]);
      for (let r = 18; r <= 22; r++) fill(g, r, l.trim, [11, 12]);
      for (let r = 17; r <= 21; r++) {
        px(g, r, 8 + (r - 17) / 2 - ((r - 17) % 2) / 2, dark);
        px(g, r, 15 - (r - 17) / 2 + ((r - 17) % 2) / 2, dark);
      }
      break;
    case 'robe':
      fill(g, 17, l.trim, [8, 15]);
      for (let r = 18; r <= 23; r++) fill(g, r, l.trim, [11, 12]);
      break;
    case 'cape':
      fill(g, 16, l.trim, [6, 8], [15, 17]);
      fill(g, 17, l.trim, [5, 9], [14, 18]);
      fill(g, 18, l.trim, [5, 7], [16, 18]);
      px(g, 18, 11, l.trim);
      px(g, 18, 12, l.trim);
      break;
    case 'gi':
      for (let r = 17; r <= 23; r++) {
        px(g, r, 8 + Math.floor((r - 17) / 2), dark);
        px(g, r, 15 - Math.floor((r - 17) / 2), dark);
      }
      fill(g, 22, l.trim, [1, 22]);
      break;
    case 'dress':
      fill(g, 17, l.trim, [8, 15]);
      fill(g, 18, l.trim, [9, 14]);
      fill(g, 19, l.trim, [10, 13]);
      for (let r = 20; r <= 23; r++) px(g, r, 3, dark);
      break;
  }
}

function drawHead(g: Grid, l: Look): void {
  const skin = l.skin;
  const dark = shade(skin, 0.86);
  // neck
  fill(g, 15, dark, [10, 13]);
  fill(g, 16, dark, [10, 13]);
  // face
  fill(g, 4, skin, [8, 15]);
  fill(g, 5, skin, [7, 16]);
  for (let r = 6; r <= 13; r++) fill(g, r, skin, [6, 17]);
  fill(g, 14, skin, [7, 16]);
  fill(g, 15, skin, [8, 15]);
  // ears
  if (l.hairStyle !== 'hood') {
    fill(g, 9, dark, [5, 5], [18, 18]);
    fill(g, 10, dark, [5, 5], [18, 18]);
  }
}

function drawHair(g: Grid, l: Look): void {
  const h = l.hair;
  const hi = shade(h, 0.9);
  switch (l.hairStyle) {
    case 'spiky':
      fill(g, 1, h, [8, 8], [12, 12], [16, 16]);
      fill(g, 2, h, [7, 9], [11, 13], [15, 17]);
      fill(g, 3, h, [6, 17]);
      fill(g, 4, h, [6, 17]);
      fill(g, 5, h, [6, 8], [11, 12], [15, 17]);
      fill(g, 6, h, [5, 6], [17, 18]);
      fill(g, 7, h, [5, 6], [17, 18]);
      fill(g, 8, h, [5, 5], [18, 18]);
      px(g, 3, 9, hi);
      break;
    case 'tall':
      fill(g, 0, h, [8, 15]);
      fill(g, 1, h, [7, 16]);
      fill(g, 2, h, [6, 17]);
      fill(g, 3, h, [6, 17]);
      fill(g, 4, h, [6, 17]);
      fill(g, 5, h, [6, 7], [16, 17]);
      fill(g, 6, h, [6, 6], [17, 17]);
      px(g, 1, 9, hi);
      break;
    case 'flat':
      fill(g, 2, h, [8, 15]);
      fill(g, 3, h, [7, 16]);
      fill(g, 4, h, [6, 17]);
      fill(g, 5, h, [6, 17]);
      fill(g, 6, h, [6, 7], [16, 17]);
      fill(g, 7, h, [6, 6], [17, 17]);
      break;
    case 'bob':
    case 'long': {
      const bottom = l.hairStyle === 'bob' ? 13 : 21;
      fill(g, 2, h, [8, 15]);
      fill(g, 3, h, [7, 16]);
      fill(g, 4, h, [6, 17]);
      fill(g, 5, h, [5, 18]);
      fill(g, 6, h, [5, 7], [16, 18]);
      for (let r = 7; r <= bottom; r++)
        fill(g, r, h, [l.hairStyle === 'long' ? 4 : 5, 6], [17, l.hairStyle === 'long' ? 19 : 18]);
      px(g, 3, 9, shade(h, 1));
      break;
    }
    case 'ponytail':
      fill(g, 2, h, [8, 15]);
      fill(g, 3, h, [7, 16]);
      fill(g, 4, h, [6, 17]);
      fill(g, 5, h, [6, 12]);
      fill(g, 6, h, [5, 6], [17, 18]);
      fill(g, 7, h, [5, 6], [17, 18]);
      fill(g, 5, h, [17, 17]);
      px(g, 5, 18, l.accent ?? h);
      px(g, 5, 19, l.accent ?? h);
      for (let r = 6; r <= 12; r++) fill(g, r, h, [19, r < 10 ? 21 : 20]);
      px(g, 13, 20, h);
      break;
    case 'bun':
      fill(g, 0, h, [10, 13]);
      fill(g, 1, h, [9, 14]);
      fill(g, 2, h, [9, 14]);
      fill(g, 3, h, [8, 15]);
      fill(g, 4, h, [7, 16]);
      fill(g, 5, h, [6, 17]);
      fill(g, 6, h, [6, 6], [17, 17]);
      fill(g, 7, h, [6, 6], [17, 17]);
      fill(g, 8, h, [6, 6], [17, 17]);
      break;
    case 'slick':
      fill(g, 3, h, [7, 16]);
      fill(g, 4, h, [6, 17]);
      fill(g, 5, h, [6, 9], [14, 17]);
      fill(g, 6, h, [6, 7], [16, 17]);
      fill(g, 7, h, [6, 6], [17, 17]);
      px(g, 3, 10, shade(h, 1));
      break;
    case 'bald':
      fill(g, 8, h, [5, 5], [18, 18]);
      fill(g, 9, h, [5, 5], [18, 18]);
      fill(g, 10, h, [5, 5], [18, 18]);
      fill(g, 11, h, [5, 5], [18, 18]);
      fill(g, 5, GLINT, [9, 9]);
      break;
    case 'hood':
      fill(g, 2, h, [9, 14]);
      fill(g, 3, h, [8, 15]);
      fill(g, 4, h, [7, 16]);
      fill(g, 5, h, [6, 17]);
      for (let r = 6; r <= 16; r++) fill(g, r, h, [5, 6], [17, 18]);
      fill(g, 6, l.accent ?? h, [7, 16]);
      fill(g, 7, h, [7, 16]);
      break;
  }
}

function drawFace(g: Grid, l: Look): void {
  const eye = l.eyeColor ?? INK;
  switch (l.eyes) {
    case 'dot':
      fill(g, 9, INK, [8, 9], [14, 15]);
      fill(g, 10, INK, [8, 9], [14, 15]);
      px(g, 9, 8, GLINT);
      px(g, 9, 14, GLINT);
      break;
    case 'squint':
      fill(g, 10, INK, [8, 10], [13, 15]);
      fill(g, 9, shade(l.skin, 0.7), [8, 10], [13, 15]);
      break;
    case 'bright':
      fill(g, 9, GLINT, [8, 9], [14, 15]);
      fill(g, 10, eye, [8, 9], [14, 15]);
      px(g, 9, 9, eye);
      px(g, 9, 14, eye);
      break;
    case 'slit':
      fill(g, 9, INK, [8, 10], [13, 15]);
      fill(g, 10, GLINT, [9, 9], [14, 14]);
      break;
    case 'glasses': {
      const lens = l.skin;
      for (const [a, b] of [
        [7, 10],
        [13, 16],
      ] as const) {
        fill(g, 8, INK, [a, b]);
        fill(g, 11, INK, [a, b]);
        px(g, 9, a, INK);
        px(g, 10, a, INK);
        px(g, 9, b, INK);
        px(g, 10, b, INK);
        fill(g, 9, lens, [a + 1, b - 1]);
        fill(g, 10, lens, [a + 1, b - 1]);
        px(g, 9, a + 1, INK);
        px(g, 9, b - 1, INK);
        px(g, 9, a + 2, GLINT);
        px(g, 9, b - 2, GLINT);
      }
      px(g, 9, 11, INK);
      px(g, 9, 12, INK);
      break;
    }
    case 'shades':
      fill(g, 8, INK, [7, 16]);
      fill(g, 9, INK, [7, 16]);
      fill(g, 10, INK, [7, 10], [13, 16]);
      px(g, 9, 8, '#5a6a88');
      px(g, 9, 14, '#5a6a88');
      break;
  }
  if (l.extras?.includes('lashes')) {
    px(g, 8, 7, INK);
    px(g, 8, 16, INK);
  }
  // nose
  px(g, 11, 12, shade(l.skin, 0.74));
  if (l.extras?.includes('mask')) {
    const m = l.accent ?? l.top;
    for (let r = 11; r <= 15; r++) fill(g, r, shade(l.top, 1), [6, 17]);
    fill(g, 11, m, [7, 16]);
    return;
  }
  if (l.extras?.includes('beard')) {
    const beard = '#f4f0f0';
    fill(g, 12, beard, [8, 15]);
    fill(g, 13, beard, [7, 16]);
    fill(g, 14, beard, [7, 16]);
    fill(g, 15, beard, [8, 15]);
    fill(g, 12, shade(beard, 0.9), [10, 13]);
    return;
  }
  const mouth = shade(l.skin, 0.55);
  switch (l.mouth) {
    case 'smile':
      px(g, 13, 9, mouth);
      px(g, 14, 10, mouth);
      px(g, 14, 11, mouth);
      px(g, 14, 12, mouth);
      px(g, 14, 13, mouth);
      px(g, 13, 14, mouth);
      break;
    case 'flat':
      fill(g, 13, mouth, [10, 13]);
      break;
    case 'smirk':
      px(g, 13, 10, mouth);
      px(g, 13, 11, mouth);
      px(g, 13, 12, mouth);
      px(g, 13, 13, mouth);
      px(g, 12, 14, mouth);
      break;
    case 'frown':
      px(g, 14, 10, mouth);
      fill(g, 13, mouth, [11, 12]);
      px(g, 14, 13, mouth);
      break;
  }
}

function drawExtras(g: Grid, l: Look): void {
  if (l.extras?.includes('hairpin')) {
    const a = l.accent ?? '#f6a8c8';
    px(g, 4, 15, a);
    px(g, 5, 16, a);
    px(g, 3, 15, shade(a, 1));
    px(g, 4, 16, '#ffffff');
  }
  if (l.extras?.includes('necklace')) {
    const a = l.accent ?? '#f0c030';
    for (let c = 9; c <= 14; c++) px(g, 18 + (c === 9 || c === 14 ? -1 : c === 11 || c === 12 ? 1 : 0), c, a);
    px(g, 20, 11, a);
    px(g, 20, 12, a);
  }
  if (l.extras?.includes('cane')) {
    for (let r = 14; r <= 23; r++) px(g, r, 21, '#8a6a3a');
    fill(g, 14, '#8a6a3a', [20, 22]);
  }
}

/** The 24x24 grid of colours for a character, or null for an unknown id. */
export function portraitGrid(id: string): Grid | null {
  const look = LOOKS[id];
  if (!look) return null;
  const g = blank(look.bg);
  // a darker band along the bottom gives the backdrop some depth
  for (let r = 20; r < GRID; r++) fill(g, r, shade(look.bg, 0.9), [0, GRID - 1]);
  drawTorso(g, look);
  drawHead(g, look);
  drawHair(g, look);
  drawFace(g, look);
  drawExtras(g, look);
  return g;
}

/** Horizontal runs of one colour, so the SVG has few rectangles. */
export function portraitRuns(grid: Grid): { row: number; col: number; len: number; color: string }[] {
  const runs: { row: number; col: number; len: number; color: string }[] = [];
  grid.forEach((cells, row) => {
    let col = 0;
    while (col < cells.length) {
      const color = cells[col];
      let len = 1;
      while (col + len < cells.length && cells[col + len] === color) len++;
      if (color) runs.push({ row, col, len, color });
      col += len;
    }
  });
  return runs;
}
