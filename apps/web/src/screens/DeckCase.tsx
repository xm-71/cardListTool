import { useMemo, useState } from 'react';
import { sfx } from '../audio/sfx.ts';
import { deckById, type DeckId } from '../game/catalog.ts';
import { caseEntries, caseFilters, filterEntries } from '../game/deckCase.ts';
import { ScreenFrame } from '../nav/ScreenFrame.tsx';
import { useNav } from '../nav/useNav.ts';
import { useProfile } from '../profile/useProfile.ts';
import { CaseBox } from '../ui/deckcase/CaseBox.tsx';
import { CasePreview } from '../ui/deckcase/CasePreview.tsx';
import { Sheet } from '../ui/Sheet.tsx';
import { Box } from '../ui/retro/index.ts';
import { useIsPhone } from '../ui/useIsPhone.ts';

const chipLabel = (f: string) =>
  f === 'all' ? 'All' : f === 'premade' ? 'Premade' : f === 'custom' ? 'Custom' : f;

/** The Deck Case: every deck the player can use, as boxes, with a filter and a card-list preview. */
export function DeckCase() {
  const profile = useProfile((s) => s.profile);
  const setActiveDeck = useProfile((s) => s.setActiveDeck);
  const phone = useIsPhone();
  const [filter, setFilter] = useState('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const entries = useMemo(() => caseEntries(profile), [profile]);
  const filters = caseFilters(entries);
  const shown = filterEntries(entries, filter);
  const open = entries.find((e) => e.id === openId);
  const cards = !open
    ? []
    : open.kind === 'custom'
      ? (profile.decks.find((d) => `custom:${d.id}` === open.id)?.cards ?? [])
      : deckById(open.id as DeckId).list.cards;

  const use = async () => {
    if (!open) return;
    sfx('confirm');
    await setActiveDeck(open.id);
    useNav.getState().leave();
  };
  const preview = open && <CasePreview entry={open} cards={cards} onUse={() => void use()} />;

  return (
    <ScreenFrame wide>
      <div role="group" aria-label="Filter decks" className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`border-4 border-ink px-3 py-1 font-pixel text-[9px] uppercase ${filter === f ? 'retro-shadow bg-yellow text-ink-fixed' : 'bg-paper hover:bg-cream'}`}
          >
            {chipLabel(f)}
          </button>
        ))}
      </div>
      {!entries.some((e) => e.kind === 'custom') && (
        <p className="text-xl">Build your own decks in the Deck Builder.</p>
      )}
      <div className={`flex gap-4 ${phone ? 'flex-col' : 'items-start'}`}>
        <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((e) => (
            <CaseBox key={e.id} entry={e} selected={e.id === openId} onOpen={() => setOpenId(e.id)} />
          ))}
        </div>
        {!phone && open && (
          <Box title={open.name} className="w-96 shrink-0">
            {preview}
          </Box>
        )}
      </div>
      {phone && open && (
        <Sheet title={open.name} onClose={() => setOpenId(null)} className="max-h-[85dvh]">
          {preview}
        </Sheet>
      )}
    </ScreenFrame>
  );
}
