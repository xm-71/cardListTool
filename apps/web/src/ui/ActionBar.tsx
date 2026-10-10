import { useState } from 'react';
import { Sheet } from './Sheet.tsx';

interface Props {
  logOpen: boolean;
  onToggleLog(): void;
  /** Missing when ending the turn is not legal right now. */
  onEndTurn?: () => void;
  /** Missing when conceding is not legal right now. */
  onConcede?: () => void;
  onQuit(): void;
}

const small =
  'min-h-11 border-4 border-ink bg-paper px-2 font-pixel text-[10px] uppercase text-ink hover:bg-cream';

/** Phone controls fixed to the bottom of the screen: Log, End turn and a Menu with Concede and Quit. */
export function ActionBar({ logOpen, onToggleLog, onEndTurn, onConcede, onQuit }: Props) {
  const [menu, setMenu] = useState(false);
  return (
    <>
      <div
        role="toolbar"
        aria-label="Game controls"
        className="fixed inset-x-0 bottom-0 z-20 flex gap-2 border-t-4 border-ink bg-paper px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden"
      >
        <button
          type="button"
          aria-label={logOpen ? 'Hide log' : 'Show log'}
          aria-expanded={logOpen}
          onClick={onToggleLog}
          className={`flex-1 ${small}`}
        >
          Log
        </button>
        {onEndTurn && (
          <button
            type="button"
            onClick={onEndTurn}
            className="retro-shadow min-h-11 flex-[2] border-4 border-ink bg-yellow px-2 font-pixel text-[10px] uppercase text-ink hover:brightness-105"
          >
            End turn
          </button>
        )}
        <button type="button" onClick={() => setMenu(true)} className={`flex-1 ${small}`}>
          Menu
        </button>
      </div>
      {menu && (
        <Sheet title="Game menu" onClose={() => setMenu(false)}>
          <div className="flex flex-col gap-2">
            {onConcede && (
              <button
                type="button"
                className={`py-3 ${small}`}
                onClick={() => {
                  setMenu(false);
                  onConcede();
                }}
              >
                Concede
              </button>
            )}
            <button
              type="button"
              className={`py-3 ${small}`}
              onClick={() => {
                setMenu(false);
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
