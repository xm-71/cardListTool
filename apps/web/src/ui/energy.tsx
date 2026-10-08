import type { EnergyType } from '@ptcg/engine';

/** Background colour and short symbol for each Energy type. */
export const ENERGY_STYLE: Record<EnergyType, { bg: string; symbol: string }> = {
  Grass: { bg: 'bg-green-600', symbol: 'G' },
  Fire: { bg: 'bg-red-600', symbol: 'R' },
  Water: { bg: 'bg-sky-600', symbol: 'W' },
  Lightning: { bg: 'bg-yellow-400 text-slate-900', symbol: 'L' },
  Psychic: { bg: 'bg-purple-600', symbol: 'P' },
  Fighting: { bg: 'bg-orange-700', symbol: 'F' },
  Darkness: { bg: 'bg-slate-800 ring-1 ring-slate-400', symbol: 'D' },
  Metal: { bg: 'bg-zinc-400 text-slate-900', symbol: 'M' },
  Dragon: { bg: 'bg-amber-600', symbol: 'N' },
  Colorless: { bg: 'bg-slate-200 text-slate-900', symbol: 'C' },
};

export function EnergyDot({ type, title }: { type: EnergyType; title?: string }) {
  const s = ENERGY_STYLE[type];
  return (
    <span
      title={title ?? `${type} Energy`}
      className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white ${s.bg}`}
    >
      {s.symbol}
    </span>
  );
}
