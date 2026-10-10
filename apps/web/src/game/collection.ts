import { setCards } from '@ptcg/cards';

/** How many distinct cards of a set the collection holds, out of all the set's cards. */
export function setProgress(
  collection: Readonly<Record<string, number>>,
  setId: string,
): { owned: number; total: number } {
  const cards = setCards(setId);
  return { owned: cards.filter((c) => (collection[c.id] ?? 0) > 0).length, total: cards.length };
}
