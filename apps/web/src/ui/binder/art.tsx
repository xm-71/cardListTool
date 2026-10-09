import { useId } from 'react';
import type { BinderBackground, BinderColor, StickerId } from '../../profile/types.ts';

export const COLOR_VAR: Record<BinderColor, string> = {
  red: 'var(--color-red)',
  blue: 'var(--color-blue)',
  yellow: 'var(--color-yellow)',
  green: 'var(--color-green)',
  purple: 'var(--color-purple)',
  ink: 'var(--color-ink)',
  cream: 'var(--color-cream)',
  pink: 'var(--color-pink)',
};

const PIXEL: Record<string, string> = {
  k: 'var(--color-ink)',
  r: 'var(--color-red)',
  y: 'var(--color-yellow)',
  g: 'var(--color-green)',
  b: 'var(--color-blue)',
  w: '#ffffff',
};

/** 8×8 pixel art; '.' is transparent. */
const STICKER_ART: Record<StickerId, string[]> = {
  pokeball: ['..kkkk..', '.krrrrk.', 'krrrrrrk', 'kkkwwkkk', 'kwwwwwwk', 'kwwwwwwk', '.kwwwwk.', '..kkkk..'],
  star: ['...yy...', '...yy...', 'yyyyyyyy', '.yyyyyy.', '..yyyy..', '.yy..yy.', 'yy....yy', '........'],
  heart: ['.rr..rr.', 'rrrrrrrr', 'rrrrrrrr', 'rrrrrrrr', '.rrrrrr.', '..rrrr..', '...rr...', '........'],
  crown: ['........', 'y..yy..y', 'yy.yy.yy', 'yyyyyyyy', 'yyryyryy', 'yyyyyyyy', 'yyyyyyyy', '........'],
  flame: ['...r....', '..rr....', '..rrr.r.', '.rryrrr.', '.ryyyrr.', 'rryyyyrr', '.ryyyyr.', '..rrrr..'],
  leaf: ['......gg', '....gggg', '..ggggg.', '.gggkgg.', '.ggkggg.', 'gggggg..', '.kgg....', 'k.......'],
  drop: ['...b....', '...bb...', '..bbbb..', '.bbbbbb.', '.bwbbbb.', '.bwbbbb.', '..bbbb..', '........'],
  bolt: ['....yyy.', '...yyy..', '..yyy...', '.yyyyyy.', '....yy..', '...yy...', '..yy....', '.y......'],
};

/** A pixel-art sticker, drawn as SVG rects. */
export function Sticker({ id, size = 32 }: { id: StickerId; size?: number }) {
  return (
    <svg
      role="img"
      aria-label={id}
      width={size}
      height={size}
      viewBox="0 0 8 8"
      shapeRendering="crispEdges"
      style={{ filter: 'drop-shadow(1px 1px 0 var(--color-ink))' }}
    >
      {STICKER_ART[id].flatMap((row, y) =>
        [...row].map((c, x) =>
          c === '.' ? null : <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={PIXEL[c]} />,
        ),
      )}
    </svg>
  );
}

/** One tile of each background pattern, in a 16×16 box. */
const PATTERN: Record<Exclude<BinderBackground, 'plain'>, React.JSX.Element> = {
  pokeball: (
    <>
      <circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3" y="7.25" width="10" height="1.5" fill="currentColor" />
      <circle cx="8" cy="8" r="1.6" fill="currentColor" />
    </>
  ),
  stripes: <path d="M-2 18 L18 -2 M-2 10 L10 -2 M6 18 L18 6" stroke="currentColor" strokeWidth="2.5" />,
  stars: <path d="M8 3 L9.2 6.8 L13 8 L9.2 9.2 L8 13 L6.8 9.2 L3 8 L6.8 6.8 Z" fill="currentColor" />,
  grid: <path d="M0 0.5 H16 M0.5 0 V16" stroke="currentColor" strokeWidth="1" />,
  energy: (
    <>
      <circle cx="8" cy="8" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8.8 4.8 L6.3 8.4 H8 L7.2 11.2 L9.7 7.6 H8 Z" fill="currentColor" />
    </>
  ),
};

/** A faint repeating pattern that fills its (relatively positioned) parent. */
export function Background({ kind }: { kind: BinderBackground }) {
  const id = useId();
  if (kind === 'plain') return null;
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full text-white opacity-30">
      <defs>
        <pattern id={id} width="24" height="24" patternUnits="userSpaceOnUse">
          <g transform="scale(1.5)">{PATTERN[kind]}</g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
