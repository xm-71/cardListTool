import type { CaseEntry } from '../../game/deckCase.ts';
import type { RunCards } from '../../game/frontier/deck.ts';
import { Button } from '../retro/index.ts';
import { RunDeckView } from '../frontier/RunDeckView.tsx';

/** A deck's card list and the button that makes it the active deck. */
export function CasePreview({ entry, cards, onUse }: { entry: CaseEntry; cards: RunCards; onUse(): void }) {
  return (
    <div className="flex flex-col gap-3">
      <RunDeckView cards={cards} label="Deck list" />
      {entry.problem && <p className="text-xl">{entry.problem}</p>}
      <Button onClick={onUse} disabled={entry.active || entry.problem !== null} className="self-start">
        {entry.active ? 'Active deck' : 'Use this deck'}
      </Button>
    </div>
  );
}
