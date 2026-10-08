/** Wrapper colours per set. */
const COLOURS: Record<string, [string, string]> = {
  me01: ['var(--color-red)', '#902828'],
  me02: ['var(--color-purple)', '#4a3080'],
};

/** A CSS-drawn booster pack; `torn` hides the top strip (pack opening). */
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
  const [from, to] = COLOURS[setId] ?? ['var(--color-blue)', '#24488c'];
  return (
    <div
      data-testid="pack-art"
      aria-hidden
      className={`retro-shadow relative h-48 w-32 border-4 border-ink ${className}`}
      style={{ background: `linear-gradient(170deg, ${from}, ${to})` }}
    >
      {!torn && (
        <div
          data-part="strip"
          className="absolute inset-x-0 top-0 h-6 border-b-4 border-dashed border-paper"
        />
      )}
      <div className="absolute inset-x-2 top-16 text-center font-pixel text-[9px] leading-relaxed text-yellow [text-shadow:2px_2px_var(--color-ink)]">
        {name.toUpperCase()}
      </div>
      <div className="absolute inset-x-0 bottom-3 text-center font-pixel text-[7px] text-paper">10 CARDS</div>
    </div>
  );
}
