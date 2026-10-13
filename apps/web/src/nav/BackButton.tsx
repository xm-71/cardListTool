import { sfx } from '../audio/sfx.ts';
import { Button } from '../ui/retro/index.ts';
import { useNav } from './useNav.ts';

/** "◀ Back" to the main menu (or to the screen that opened this one, when it says so). */
export function BackButton() {
  return (
    <Button
      variant="plain"
      aria-label="Back"
      onClick={() => {
        sfx('back');
        useNav.getState().leave();
      }}
    >
      ◀ Back
    </Button>
  );
}
