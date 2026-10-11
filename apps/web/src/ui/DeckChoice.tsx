import { sfx } from '../audio/sfx.ts';
import { registry, type DeckSource } from '../game/catalog.ts';
import { Box } from './retro/index.ts';

/** A picker for one deck: starter, theme and custom decks as pressable cards. */
export function DeckChoice({
  label,
  group,
  decks,
  value,
  onChange,
}: {
  label: string;
  group: string;
  decks: DeckSource[];
  value: string;
  onChange(id: string): void;
}) {
  const sections = [
    { kind: 'starter', title: 'Starter decks' },
    { kind: 'theme', title: 'Theme decks' },
    { kind: 'custom', title: 'Custom decks' },
  ] as const;
  return (
    <Box title={label}>
      <div role="group" aria-label={group} className="flex flex-col gap-3">
        {sections.map(({ kind, title }) => {
          const list = decks.filter((d) => d.kind === kind);
          if (list.length === 0) return null;
          return (
            <div key={kind} role="group" aria-label={title} className="flex flex-col gap-2">
              <h3 className="font-pixel text-[9px] uppercase">{title}</h3>
              <div className="flex flex-wrap gap-3">
                {list.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    aria-pressed={value === d.id}
                    onClick={() => {
                      sfx('cursor');
                      onChange(d.id);
                    }}
                    className={`flex w-28 flex-col items-center gap-2 border-4 border-ink p-2 ${value === d.id ? 'retro-shadow bg-yellow text-ink-fixed' : 'bg-paper hover:bg-cream'}`}
                  >
                    <img src={`${registry.defs[d.cover]!.image}/low.webp`} alt="" className="w-20" />
                    <span className="font-pixel text-[8px] leading-relaxed">{d.name}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Box>
  );
}
