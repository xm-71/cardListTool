import { useState } from 'react';
import { MAX_BINDERS, newBinder } from '../../profile/binders.ts';
import type { CustomBinder } from '../../profile/types.ts';
import { useProfile } from '../../profile/useProfile.ts';
import { Button } from '../retro/index.ts';
import { BinderCover } from './BinderCover.tsx';
import { CoverEditor } from './CoverEditor.tsx';

const newId = (): string => `binder-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** The player's binders as covers on a shelf, plus "New binder". */
export function BinderShelf({ onOpen }: { onOpen(id: string): void }) {
  const binders = useProfile((s) => s.profile.binders);
  const saveBinder = useProfile((s) => s.saveBinder);
  const [draft, setDraft] = useState<CustomBinder | null>(null);
  return (
    <section aria-label="My binders" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={binders.length >= MAX_BINDERS}
          onClick={() => setDraft(newBinder(newId(), Date.now()))}
        >
          New binder
        </Button>
        <span className="text-xl">
          {binders.length} / {MAX_BINDERS} binders
        </span>
      </div>
      {binders.length === 0 && (
        <p className="text-xl">Make a binder for your favourite cards, then decorate its cover.</p>
      )}
      <ul className="flex flex-wrap gap-6">
        {binders.map((b) => (
          <li key={b.id}>
            <button
              type="button"
              aria-label={`Open ${b.name}`}
              onClick={() => onOpen(b.id)}
              className="hover:-translate-y-1"
            >
              <BinderCover binder={b} />
            </button>
          </li>
        ))}
      </ul>
      {draft && (
        <CoverEditor
          binder={draft}
          onClose={() => setDraft(null)}
          onSave={(b) => {
            setDraft(null);
            void saveBinder(b);
          }}
        />
      )}
    </section>
  );
}
