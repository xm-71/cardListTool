import { useState, type ReactNode } from 'react';
import { Sheet } from './Sheet.tsx';

interface Props {
  handCount: number;
  onHand(): void;
  /** Missing when ending the turn is not legal right now. */
  onEndTurn?: () => void;
  /** Missing when conceding is not legal right now. */
  onConcede?: () => void;
  onQuit(): void;
  /** The battle log, shown in the Menu when the player asks for it. */
  log: ReactNode;
}

const small =
  'min-h-11 border-4 border-ink bg-paper px-2 font-pixel text-[10px] uppercase text-ink hover:bg-cream';

/** Phone controls fixed to the bottom of the screen: the Hand, End turn and a Menu with the log, Concede and Quit. */
export function ActionBar({ handCount, onHand, onEndTurn, onConcede, onQuit, log }: Props) {
  const [menu, setMenu] = useState(false);
  const [logShown, setLogShown] = useState(false);
  return (
    <>
      <div
        role="toolbar"
        aria-label="Game controls"
        className="fixed inset-x-0 bottom-0 z-20 flex gap-2 border-t-4 border-ink bg-paper px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden"
      >
        <button type="button" onClick={onHand} className={`flex-1 ${small}`}>
          Hand {handCount}
        </button>
        {onEndTurn && (
          <button
            type="button"
            onClick={onEndTurn}
            className="retro-shadow min-h-11 flex-[2] border-4 border-ink bg-yellow px-2 font-pixel text-[10px] uppercase text-ink-fixed hover:brightness-105"
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
            <button
              type="button"
              aria-expanded={logShown}
              aria-label={logShown ? 'Hide log' : 'Show log'}
              className={`py-3 ${small}`}
              onClick={() => setLogShown((open) => !open)}
            >
              {logShown ? 'Hide log' : 'Show log'}
            </button>
            {logShown && <div className="flex max-h-[40dvh] flex-col">{log}</div>}
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
