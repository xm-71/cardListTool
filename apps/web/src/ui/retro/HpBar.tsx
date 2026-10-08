/** Pixel HP bar: green above half, yellow down to a fifth, red below. */
export function HpBar({ hp, max }: { hp: number; max: number }) {
  const ratio = max > 0 ? Math.max(0, hp) / max : 0;
  const level = ratio > 0.5 ? 'high' : ratio >= 0.2 ? 'mid' : 'low';
  const colour = level === 'high' ? 'bg-green' : level === 'mid' ? 'bg-yellow' : 'bg-red';
  return (
    <div
      role="meter"
      aria-label="HP"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={hp}
      data-level={level}
      className="h-2.5 w-full border-2 border-ink bg-paper"
    >
      <div className={`h-full ${colour}`} style={{ width: `${ratio * 100}%` }} />
    </div>
  );
}
