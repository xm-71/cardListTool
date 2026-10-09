import { useEffect, useRef, useState } from 'react';
import { MAX_BINDER_NAME, cleanBinderName } from '../../profile/binders.ts';
import {
  BINDER_BACKGROUNDS,
  BINDER_COLORS,
  STICKER_SPOTS,
  STICKERS,
  type BinderColor,
  type CustomBinder,
  type StickerId,
  type StickerSpot,
} from '../../profile/types.ts';
import { Button } from '../retro/index.ts';
import { COLOR_VAR } from './art.tsx';
import { BinderCover } from './BinderCover.tsx';

const SPOT_LABEL: Record<StickerSpot, string> = {
  topLeft: 'Top left',
  topRight: 'Top right',
  bottomLeft: 'Bottom left',
  bottomRight: 'Bottom right',
};

interface Props {
  binder: CustomBinder;
  onSave(b: CustomBinder): void;
  /** Omitted for a binder that isn't saved yet. */
  onDelete?(): void;
  onClose(): void;
}

/** Dialog for a binder's name, colours, background and stickers, with a live preview. */
export function CoverEditor({ binder, onSave, onDelete, onClose }: Props) {
  const [draft, setDraft] = useState(binder);
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => nameRef.current?.focus(), []);
  const set = (patch: Partial<CustomBinder>) => setDraft((d) => ({ ...d, ...patch }));
  const setSticker = (spot: StickerSpot, id: string) =>
    setDraft((d) => {
      const stickers = { ...d.stickers };
      if (id) stickers[spot] = id as StickerId;
      else delete stickers[spot];
      return { ...d, stickers };
    });

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center overflow-y-auto bg-ink/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit binder"
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        className="retro-box flex max-h-full w-full max-w-2xl flex-col gap-4 overflow-y-auto p-4"
      >
        <h2 className="font-pixel text-xs uppercase">Edit binder</h2>
        <div className="flex flex-wrap items-start gap-6">
          <div className="mx-auto">
            <BinderCover binder={{ ...draft, name: cleanBinderName(draft.name) }} size="lg" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <label className="flex flex-col gap-1">
              <span className="font-pixel text-[9px] uppercase">Binder name</span>
              <input
                ref={nameRef}
                maxLength={MAX_BINDER_NAME}
                value={draft.name}
                onChange={(e) => set({ name: e.target.value })}
                className="border-b-4 border-ink bg-transparent px-1 text-2xl outline-none"
              />
            </label>
            <Swatches
              label="Cover colour"
              value={draft.coverColor}
              onChange={(c) => set({ coverColor: c })}
            />
            <Swatches label="Page colour" value={draft.pageColor} onChange={(c) => set({ pageColor: c })} />
            <div role="radiogroup" aria-label="Background" className="flex flex-wrap gap-2">
              <span className="w-full font-pixel text-[9px] uppercase">Background</span>
              {BINDER_BACKGROUNDS.map((bg) => (
                <button
                  key={bg}
                  type="button"
                  role="radio"
                  aria-checked={draft.background === bg}
                  onClick={() => set({ background: bg })}
                  className={`border-4 border-ink px-2 py-1 text-lg ${draft.background === bg ? 'bg-yellow' : 'bg-paper hover:bg-cream'}`}
                >
                  {bg}
                </button>
              ))}
            </div>
            <fieldset className="grid grid-cols-2 gap-2">
              <legend className="mb-1 font-pixel text-[9px] uppercase">Stickers</legend>
              {STICKER_SPOTS.map((spot) => (
                <label key={spot} className="flex flex-col text-lg">
                  {SPOT_LABEL[spot]}
                  <select
                    aria-label={`${SPOT_LABEL[spot]} sticker`}
                    value={draft.stickers[spot] ?? ''}
                    onChange={(e) => setSticker(spot, e.target.value)}
                    className="border-4 border-ink bg-paper px-1 text-lg"
                  >
                    <option value="">None</option>
                    {STICKERS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </fieldset>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-3">
          {onDelete && (
            <Button
              variant="plain"
              className="mr-auto text-red"
              onClick={() =>
                confirm(`Delete "${binder.name}"? Its cards stay in your collection.`) && onDelete()
              }
            >
              Delete binder
            </Button>
          )}
          <Button variant="plain" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSave({ ...draft, name: cleanBinderName(draft.name) })}>Save</Button>
        </div>
      </div>
    </div>
  );
}

function Swatches({
  label,
  value,
  onChange,
}: {
  label: string;
  value: BinderColor;
  onChange(c: BinderColor): void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      <span className="w-full font-pixel text-[9px] uppercase">{label}</span>
      {BINDER_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-label={c}
          aria-checked={value === c}
          onClick={() => onChange(c)}
          className={`size-8 border-4 ${value === c ? 'border-ink outline-2 outline-offset-2 outline-ink' : 'border-ink/60'}`}
          style={{ background: COLOR_VAR[c] }}
        />
      ))}
    </div>
  );
}
