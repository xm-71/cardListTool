import { useAnim } from '../game/animation/director.ts';
import { describeEvent, type Names } from '../game/describe.ts';

interface Props {
  /** What it says when nothing is playing ("Turn 3 · Your turn"). */
  status: string;
  names: Names;
  /** Phones: a Log button that opens the battle log. */
  onLog?: () => void;
  className?: string;
}

/**
 * One line that reads out each move as it plays ("Brock's Onix uses Rock Throw"), and the turn when nothing is
 * playing. During the opponent's turn, Skip plays the rest of their moves five times faster.
 */
export function Ticker({ status, names, onLog, className = '' }: Props) {
  const beat = useAnim((s) => s.beat);
  const busy = useAnim((s) => s.busy);
  const rushed = useAnim((s) => s.rush < 1);
  const theirs = useAnim((s) => s.target?.current !== undefined && s.target.current !== names.viewer);
  const text = busy && beat ? describeEvent(beat.event, names) : status;
  return (
    <div
      className={`flex min-h-8 min-w-0 items-center gap-2 border-2 border-ink bg-ink-fixed px-2 font-text text-lg normal-case leading-tight text-paper-fixed ${className}`}
    >
      <span role="status" className="min-w-0 flex-1 truncate">
        {text}
      </span>
      {busy && theirs && !rushed && (
        <button
          type="button"
          onClick={() => useAnim.setState({ rush: 0.2 })}
          className="shrink-0 border-2 border-paper-fixed px-1.5 py-0.5 font-pixel text-[7px] uppercase"
        >
          Skip ▸▸
        </button>
      )}
      {onLog && (
        <button
          type="button"
          onClick={onLog}
          className="shrink-0 border-2 border-paper-fixed px-1.5 py-0.5 font-pixel text-[7px] uppercase"
        >
          Log
        </button>
      )}
    </div>
  );
}
