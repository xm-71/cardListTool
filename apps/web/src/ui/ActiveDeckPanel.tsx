import { registry, type DeckSource } from '../game/catalog.ts';
import { Box, Button } from './retro/index.ts';

/** The deck a match will use, with a Change button that opens the Deck Case. */
export function ActiveDeckPanel({
  title,
  source,
  notice,
  onChange,
}: {
  title: string;
  source: DeckSource | undefined;
  notice?: string;
  onChange(): void;
}) {
  return (
    <Box title={title}>
      <div className="flex flex-wrap items-center gap-4">
        {source ? (
          <>
            <img
              src={`${registry.defs[source.cover]!.image}/low.webp`}
              alt=""
              className="retro-shadow aspect-[63/88] w-16 rounded-md border-4 border-ink"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="font-pixel text-[10px] leading-relaxed">{source.name}</span>
              <span className="text-xl opacity-70">
                {source.kind === 'custom' ? 'Custom deck' : `${source.kind} deck`}
              </span>
            </div>
          </>
        ) : (
          <p className="min-w-0 flex-1 text-xl">No deck yet. Buy a deck in the Poké Mart.</p>
        )}
        <Button variant="plain" onClick={onChange}>
          Change
        </Button>
      </div>
      {notice && (
        <p role="status" className="mt-2 text-xl text-red-fg">
          {notice}
        </p>
      )}
    </Box>
  );
}
