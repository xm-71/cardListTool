import { useEffect, useMemo, useRef, useState } from 'react';
import type { CardInstance } from '@ptcg/engine';
import { registry } from '../../game/catalog.ts';
import {
  MAX_PAGES,
  SLOTS_PER_PAGE,
  addPage,
  missingSlots,
  moveCard,
  placeCard,
  removeCard,
  removePage,
  type SlotPos,
} from '../../profile/binders.ts';
import type { CustomBinder } from '../../profile/types.ts';
import { useProfile } from '../../profile/useProfile.ts';
import { CardDetails } from '../CardDetails.tsx';
import { Button } from '../retro/index.ts';
import { Background, COLOR_VAR } from './art.tsx';
import { CardPicker } from './CardPicker.tsx';
import { CoverEditor } from './CoverEditor.tsx';
import { useDialog } from './useDialog.ts';

const slotNumber = (pos: SlotPos) => pos.page * SLOTS_PER_PAGE + pos.slot + 1;

/** An open binder: a two-page spread on wide screens (one page on phones) of 3×3 card pockets. */
export function BinderBook({ binderId, onBack }: { binderId: string; onBack(): void }) {
  const binder = useProfile((s) => s.profile.binders.find((b) => b.id === binderId));
  const collection = useProfile((s) => s.profile.collection);
  const updateBinder = useProfile((s) => s.updateBinder);
  const deleteBinder = useProfile((s) => s.deleteBinder);
  const [page, setPage] = useState(0);
  const [moving, setMoving] = useState<SlotPos | null>(null);
  const [menu, setMenu] = useState<SlotPos | null>(null);
  const [picking, setPicking] = useState<SlotPos | null>(null);
  const [editing, setEditing] = useState(false);
  const [details, setDetails] = useState<CardInstance | null>(null);
  const missing = useMemo(
    () => (binder ? missingSlots(binder, collection) : new Set<string>()),
    [binder, collection],
  );
  const pages = binder?.pages.length ?? 1;
  const dialogOpen = menu !== null || picking !== null || editing || details !== null;

  useEffect(() => {
    if (page > pages - 1) setPage(pages - 1);
  }, [page, pages]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoving(null);
      if (dialogOpen) return;
      if (e.key === 'ArrowLeft') setPage((p) => Math.max(0, p - 1));
      if (e.key === 'ArrowRight') setPage((p) => Math.min(pages - 1, p + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialogOpen, pages]);

  if (!binder) return null;
  /** Every edit is applied to the stored binder, so changes made in another tab are kept. */
  const edit = (fn: (b: CustomBinder, collection: Readonly<Record<string, number>>) => CustomBinder) =>
    void updateBinder(binder.id, fn);
  const cardAt = (pos: SlotPos) => binder.pages[pos.page]?.[pos.slot] ?? null;
  const onSlot = (pos: SlotPos) => {
    if (moving) {
      const from = moving;
      edit((b) => moveCard(b, from, pos));
      setMoving(null);
    } else if (cardAt(pos)) setMenu(pos);
    else setPicking(pos);
  };

  return (
    <section aria-label={binder.name} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="plain" aria-label="Back to binders" onClick={onBack}>
          ◀ Binders
        </Button>
        <h2 className="font-pixel text-xs uppercase">{binder.name}</h2>
        <Button variant="plain" className="ml-auto" onClick={() => setEditing(true)}>
          Edit cover
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button
          variant="plain"
          aria-label="Previous page"
          disabled={page === 0}
          onClick={() => setPage(page - 1)}
        >
          ◀
        </Button>
        <span className="font-pixel text-[10px]">
          Page {page + 1} / {pages}
        </span>
        <Button
          variant="plain"
          aria-label="Next page"
          disabled={page >= pages - 1}
          onClick={() => setPage(page + 1)}
        >
          ▶
        </Button>
        <Button variant="plain" disabled={pages >= MAX_PAGES} onClick={() => edit(addPage)}>
          Add page
        </Button>
        {pages > 1 && (
          <Button
            variant="plain"
            disabled={moving !== null}
            onClick={() => {
              const at = page;
              if (confirm(`Remove page ${at + 1}? Its cards stay in your collection.`))
                edit((b) => removePage(b, at));
            }}
          >
            Remove page
          </Button>
        )}
      </div>
      {moving && (
        <p role="status" className="text-center text-xl">
          Choose where to move the card (Esc to cancel).
        </p>
      )}
      <div className="flex justify-center gap-4">
        {[page, page + 1]
          .filter((p) => p < pages)
          .map((p, i) => (
            <div
              key={p}
              aria-label={`Page ${p + 1}`}
              className={`retro-shadow relative w-full max-w-md overflow-hidden border-4 border-ink p-3 ${i === 1 ? 'hidden lg:block' : ''}`}
              style={{ background: COLOR_VAR[binder.pageColor] }}
            >
              <Background kind={binder.background} color={binder.pageColor} />
              <div className="relative grid grid-cols-3 gap-2">
                {binder.pages[p]!.map((id, s) => {
                  const pos = { page: p, slot: s };
                  const n = slotNumber(pos);
                  const def = id ? registry.defs[id] : undefined;
                  const isMissing = missing.has(`${p}:${s}`);
                  const base = id
                    ? `Slot ${n}: ${def?.name ?? id}${isMissing ? ' (missing)' : ''}`
                    : `Empty slot ${n}`;
                  const label = moving ? `Move here: ${base}` : base;
                  const isSource = moving?.page === p && moving.slot === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      aria-label={label}
                      onClick={() => onSlot(pos)}
                      className={`aspect-[63/88] rounded border-2 ${id ? 'border-ink' : 'border-dashed border-ink/40 bg-paper/40'} ${moving ? 'ring-2 ring-yellow' : 'hover:ring-4 hover:ring-yellow'} ${isSource ? 'ring-4 ring-red' : ''}`}
                    >
                      {def && (
                        <img
                          src={`${def.image}/low.webp`}
                          alt=""
                          loading="lazy"
                          className={`h-full w-full rounded object-cover ${isMissing ? 'opacity-35 grayscale' : ''}`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
      </div>
      {menu && (
        <SlotMenu
          title={`Slot ${slotNumber(menu)}`}
          onView={() => {
            setDetails({ uid: `binder-slot-${slotNumber(menu)}`, defId: cardAt(menu)!, owner: 0 });
            setMenu(null);
          }}
          onMove={() => {
            setMoving(menu);
            setMenu(null);
          }}
          onRemove={() => {
            const at = menu;
            edit((b) => removeCard(b, at.page, at.slot));
            setMenu(null);
          }}
          onClose={() => setMenu(null)}
        />
      )}
      {picking && (
        <CardPicker
          binder={binder}
          current={cardAt(picking)}
          onClose={() => setPicking(null)}
          onPick={(id) => {
            const at = picking;
            edit((b, owned) => placeCard(b, at.page, at.slot, id, owned));
            setPicking(null);
          }}
        />
      )}
      {editing && (
        <CoverEditor
          binder={binder}
          onClose={() => setEditing(false)}
          onSave={(cover) => {
            setEditing(false);
            // Only the cover: pages may have changed elsewhere while the editor was open.
            const { name, coverColor, pageColor, background, stickers } = cover;
            edit((b) => ({ ...b, name, coverColor, pageColor, background, stickers }));
          }}
          onDelete={() => {
            setEditing(false);
            void deleteBinder(binder.id);
            onBack();
          }}
        />
      )}
      {details && <CardDetails card={details} onClose={() => setDetails(null)} />}
    </section>
  );
}

function SlotMenu({
  title,
  onView,
  onMove,
  onRemove,
  onClose,
}: {
  title: string;
  onView(): void;
  onMove(): void;
  onRemove(): void;
  onClose(): void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  useDialog(dialog, onClose);
  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={dialog}
        onClick={(e) => e.stopPropagation()}
        className="retro-box flex w-full max-w-xs flex-col gap-2 p-4"
      >
        <div className="font-pixel text-[10px] uppercase">{title}</div>
        <Button variant="plain" autoFocus onClick={onView}>
          View
        </Button>
        <Button variant="plain" onClick={onMove}>
          Move
        </Button>
        <Button variant="plain" onClick={onRemove}>
          Remove
        </Button>
        <Button variant="plain" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
