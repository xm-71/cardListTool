import { ScreenFrame } from '../nav/ScreenFrame.tsx';
import { Box } from '../ui/retro/index.ts';

/** Battle Frontier: the hub of a roguelike run (filled in by the next task). */
export function BattleFrontier() {
  return (
    <ScreenFrame>
      <Box title="Battle Frontier">
        <p className="text-xl">Eight fights, two lives. Draft your deck as you go.</p>
      </Box>
    </ScreenFrame>
  );
}
