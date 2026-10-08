import { sfx } from '../audio/sfx.ts';
import { Button } from '../ui/retro/index.ts';
import { useNav } from './useNav.ts';

/** "◀ Back" to the main menu. */
export function BackButton() {
  return (
    <Button
      variant="plain"
      aria-label="Back"
      onClick={() => {
        sfx('back');
        useNav.getState().go('menu');
      }}
    >
      ◀ Back
    </Button>
  );
}
