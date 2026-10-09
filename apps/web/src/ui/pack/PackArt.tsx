import { useState } from 'react';
import { SETS } from '@ptcg/cards';
import { packSize } from '@ptcg/economy';

/** Wrapper colours per set. */
const COLOURS: Record<string, [string, string]> = {
  me01: ['var(--color-red)', '#902828'],
  me02: ['var(--color-purple)', '#4a3080'],
  base1: ['#e8a030', '#a85818'],
  base2: ['var(--color-green)', '#2e6830'],
  base3: ['#a08868', '#5a4630'],
  base4: ['#d06850', '#7a3020'],
  base5: ['#383848', '#14141c'],
  gym1: ['#c84070', '#6e1e3c'],
  gym2: ['#3878b0', '#1c3c60'],
  neo1: ['#58a8b8', '#245a66'],
  neo2: ['#6860b8', '#302a74'],
  neo3: ['#d8b030', '#7a5c10'],
  neo4: ['#8c3c98', '#431a4c'],
  lc: ['#c8a838', '#6a5410'],
};

/** A stable colour pair for sets without a hand-picked one, so neighbouring packs in the shop look different. */
function hashColours(setId: string): [string, string] {
  let h = 0;
  for (const ch of setId) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return [`hsl(${h} 55% 50%)`, `hsl(${h} 55% 25%)`];
}

/** A CSS-drawn booster pack with its set logo; `torn` hides the top strip (pack opening). */
export function PackArt({
  setId,
  name,
  className = '',
  torn = false,
}: {
  setId: string;
  name: string;
  className?: string;
  torn?: boolean;
}) {
  const [from, to] = COLOURS[setId] ?? hashColours(setId);
  const logo = SETS.find((s) => s.id === setId)?.logo;
  const [logoFailed, setLogoFailed] = useState(false);
  return (
    <div
      data-testid="pack-art"
      className={`retro-shadow relative h-48 w-32 border-4 border-ink ${className}`}
      style={{ background: `linear-gradient(170deg, ${from}, ${to})` }}
    >
      {!torn && (
        <div
          aria-hidden
          data-part="strip"
          className="absolute inset-x-0 top-0 h-6 border-b-4 border-dashed border-paper"
        />
      )}
      <div className="absolute inset-x-2 top-12 flex h-20 items-center justify-center">
        {logo && !logoFailed ? (
          <img
            src={`${logo}.webp`}
            alt={`${name} logo`}
            draggable={false}
            onError={() => setLogoFailed(true)}
            className="max-h-full max-w-full object-contain drop-shadow-[2px_2px_0_var(--color-ink)]"
          />
        ) : (
          <span className="text-center font-pixel text-[9px] leading-relaxed text-yellow [text-shadow:2px_2px_var(--color-ink)]">
            {name.toUpperCase()}
          </span>
        )}
      </div>
      <div aria-hidden className="absolute inset-x-0 bottom-3 text-center font-pixel text-[7px] text-paper">
        {packSize(setId)} CARDS
      </div>
    </div>
  );
}
