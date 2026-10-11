import { useState, type ReactNode } from 'react';
import { Sheet } from './Sheet.tsx';

interface Props {
  /** Missing when conceding is not legal right now. */
  onConcede?: () => void;
  onQuit(): void;
  /** The battle log, shown when the player asks for it. */
  log: ReactNode;
  className?: string;
}

const item =
  'min-h-11 border-4 border-ink bg-paper px-2 py-3 font-pixel text-[10px] uppercase text-ink hover:bg-cream';

/** Phones: a Menu button opening a sheet with the battle log, Concede and Quit to home. */
export function GameMenu({ onConcede, onQuit, log, className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const [logShown, setLogShown] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`border-2 border-ink bg-paper px-2 py-1 font-pixel text-[8px] uppercase text-ink hover:bg-cream ${className}`}
      >
        Menu
      </button>
      {open && (
        <Sheet title="Game menu" onClose={() => setOpen(false)}>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              aria-expanded={logShown}
              aria-label={logShown ? 'Hide log' : 'Show log'}
              className={item}
              onClick={() => setLogShown((v) => !v)}
            >
              {logShown ? 'Hide log' : 'Show log'}
            </button>
            {logShown && <div className="flex max-h-[40dvh] flex-col">{log}</div>}
            {onConcede && (
              <button
                type="button"
                className={item}
                onClick={() => {
                  setOpen(false);
                  onConcede();
                }}
              >
                Concede
              </button>
            )}
            <button
              type="button"
              className={item}
              onClick={() => {
                setOpen(false);
                onQuit();
              }}
            >
              Quit to home
            </button>
          </div>
        </Sheet>
      )}
    </>
  );
}
