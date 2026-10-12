import type { CSSProperties, PointerEvent } from 'react';
import { FIGHTS } from '../../game/frontier/run.ts';
import { LEADERS } from '../../game/gym.ts';
import type { Building, TownStatus } from '../../game/town.ts';

interface Props {
  building: Building;
  status: TownStatus;
  active: boolean;
  closed: boolean;
  onPointerEnter(e: PointerEvent): void;
  onPointerDown(e: PointerEvent): void;
  onClick(): void;
}

/** One building on the town square: a menu item drawn as a pixel house, with its progress marker. */
export function TownBuilding({ building: b, status, active, closed, onPointerEnter, onPointerDown, onClick }: Props) {
  const tower = b.id === 'frontier';
  const wins = status.frontier?.wins ?? 0;
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      aria-label={b.label}
      disabled={closed}
      data-active={active}
      onPointerEnter={(e) => !closed && onPointerEnter(e)}
      onPointerDown={onPointerDown}
      onClick={onClick}
      className={`town-b ${tower ? 'town-tower' : ''}`}
      style={{ gridRow: b.row + 1, gridColumn: b.col + 1, '--roof': b.roof } as CSSProperties}
    >
      <span className="town-house">
        <span className="town-roof" />
        <span className="town-wall">
          {tower
            ? // Top floor first; floors light up from the ground, one per fight won this run.
              Array.from({ length: FIGHTS }, (_, i) => (
                <span key={i} className="town-win" data-testid="floor" data-lit={FIGHTS - 1 - i < wins} />
              ))
            : [0, 1].map((i) => <span key={i} className="town-win" />)}
        </span>
        {!closed && b.id === 'gym' && (
          <span className="town-tag town-flag" data-champion={status.champion}>
            {`${status.badges}/${LEADERS.length}`}
          </span>
        )}
        {!closed && b.id === 'shop' && status.canBuyPack && <span className="town-tag town-new">NEW</span>}
        {b.id === 'binder' && <span className="town-tag town-count">{status.owned}</span>}
        {b.id === 'house' && <span className="town-mail" />}
        {closed && <span className="town-tag town-closed">CLOSED</span>}
      </span>
      <span className="town-name">{b.sign}</span>
    </button>
  );
}
