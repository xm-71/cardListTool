/** The Prize cards still to take, as a grid of card backs; taken Prizes leave an empty space. */
export function PrizeGrid({ count, total }: { count: number; total: number }) {
  return (
    <div
      data-prizes
      role="img"
      aria-label={`${count} ${count === 1 ? 'Prize' : 'Prizes'}`}
      className="grid grid-cols-2 gap-1"
    >
      {Array.from({ length: Math.max(total, count) }, (_, i) =>
        i < count ? (
          <div
            key={i}
            data-prize
            className="card-back relative aspect-[63/88] w-[min(2.25rem,3.4vh)] min-w-6 border-2 border-ink"
          />
        ) : (
          <div
            key={i}
            className="aspect-[63/88] w-[min(2.25rem,3.4vh)] min-w-6 border-2 border-dashed border-ink/30"
          />
        ),
      )}
    </div>
  );
}
