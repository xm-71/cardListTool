/** A CSS-drawn Poké Ball. */
export function PokeBall({ size = 64 }: { size?: number }) {
  const border = Math.max(3, Math.round(size / 16));
  return (
    <div
      aria-hidden
      className="relative rounded-full border-ink-fixed"
      style={{
        width: size,
        height: size,
        borderWidth: border,
        background: `linear-gradient(var(--color-red) 0 45%, var(--color-ink-fixed) 45% 55%, #fff 55%)`,
      }}
    >
      <div
        className="absolute rounded-full border-ink-fixed bg-white"
        style={{ inset: size * 0.3, borderWidth: border }}
      />
    </div>
  );
}
