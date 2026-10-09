import { GRID, portraitGrid, portraitRuns } from '../game/portraits.ts';

/** A pixel-art portrait of a Gym Challenge character (a gym leader, an Elite Four member or the Champion). */
export function CharacterPortrait({
  id,
  name,
  size = 80,
  className = '',
}: {
  id: string;
  /** Spoken name; leave empty when the name is shown next to the portrait. */
  name?: string;
  size?: number;
  className?: string;
}) {
  const grid = portraitGrid(id);
  if (!grid) return null;
  return (
    <svg
      role={name ? 'img' : undefined}
      aria-label={name}
      aria-hidden={name ? undefined : true}
      viewBox={`0 0 ${GRID} ${GRID}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={`border-4 border-ink ${className}`}
    >
      {portraitRuns(grid).map((r) => (
        <rect key={`${r.row}-${r.col}`} x={r.col} y={r.row} width={r.len} height={1} fill={r.color} />
      ))}
    </svg>
  );
}
