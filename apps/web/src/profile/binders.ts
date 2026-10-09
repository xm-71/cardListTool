import {
  BINDER_BACKGROUNDS,
  BINDER_COLORS,
  STICKER_SPOTS,
  STICKERS,
  type CustomBinder,
  type StickerId,
  type StickerSpot,
} from './types.ts';

export const MAX_BINDERS = 50;
export const MAX_PAGES = 40;
export const SLOTS_PER_PAGE = 9;
export const MAX_BINDER_NAME = 20;
const DEFAULT_NAME = 'My binder';

export interface SlotPos {
  page: number;
  slot: number;
}

const emptyPage = (): (string | null)[] => Array<string | null>(SLOTS_PER_PAGE).fill(null);

export function newBinder(id: string, now: number): CustomBinder {
  return {
    id,
    name: DEFAULT_NAME,
    coverColor: 'red',
    pageColor: 'cream',
    background: 'plain',
    stickers: {},
    pages: [emptyPage()],
    updatedAt: now,
  };
}

export function cleanBinderName(name: string): string {
  return name.trim().slice(0, MAX_BINDER_NAME) || DEFAULT_NAME;
}

const oneOf = <T extends string>(list: readonly T[], value: unknown, fallback: T): T =>
  list.includes(value as T) ? (value as T) : fallback;

/** Repairs a binder read from storage; null when it isn't a binder at all. */
export function normalizeBinder(raw: unknown): CustomBinder | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string') return null;
  const base = newBinder(r.id, typeof r.updatedAt === 'number' ? r.updatedAt : 0);
  const stickers: Partial<Record<StickerSpot, StickerId>> = {};
  const rawStickers = (r.stickers && typeof r.stickers === 'object' ? r.stickers : {}) as Record<
    string,
    unknown
  >;
  for (const spot of STICKER_SPOTS) {
    if ((STICKERS as readonly unknown[]).includes(rawStickers[spot]))
      stickers[spot] = rawStickers[spot] as StickerId;
  }
  const pages = (Array.isArray(r.pages) ? r.pages : []).slice(0, MAX_PAGES).map((page) =>
    Array.from({ length: SLOTS_PER_PAGE }, (_, i) => {
      const id = Array.isArray(page) ? page[i] : null;
      return typeof id === 'string' ? id : null;
    }),
  );
  return {
    ...base,
    name: cleanBinderName(typeof r.name === 'string' ? r.name : ''),
    coverColor: oneOf(BINDER_COLORS, r.coverColor, base.coverColor),
    pageColor: oneOf(BINDER_COLORS, r.pageColor, base.pageColor),
    background: oneOf(BINDER_BACKGROUNDS, r.background, base.background),
    stickers,
    pages: pages.length ? pages : base.pages,
  };
}

const uses = (b: CustomBinder, cardId: string): number =>
  b.pages.reduce((n, page) => n + page.filter((id) => id === cardId).length, 0);

export function placementsLeft(
  b: CustomBinder,
  cardId: string,
  collection: Readonly<Record<string, number>>,
): number {
  return Math.max(0, (collection[cardId] ?? 0) - uses(b, cardId));
}

const withSlot = (b: CustomBinder, page: number, slot: number, value: string | null): CustomBinder => ({
  ...b,
  pages: b.pages.map((p, i) => (i === page ? p.map((id, j) => (j === slot ? value : id)) : p)),
});

/** Puts a card in a slot (replacing what was there); unchanged when every owned copy is already placed. */
export function placeCard(
  b: CustomBinder,
  page: number,
  slot: number,
  cardId: string,
  collection: Readonly<Record<string, number>>,
): CustomBinder {
  const current = b.pages[page]?.[slot];
  if (current === undefined) return b;
  if (current !== cardId && placementsLeft(b, cardId, collection) === 0) return b;
  return withSlot(b, page, slot, cardId);
}

/** Swaps two slots (either may be empty). */
export function moveCard(b: CustomBinder, from: SlotPos, to: SlotPos): CustomBinder {
  const a = b.pages[from.page]?.[from.slot];
  const c = b.pages[to.page]?.[to.slot];
  if (a === undefined || c === undefined) return b;
  return withSlot(withSlot(b, from.page, from.slot, c), to.page, to.slot, a);
}

export function removeCard(b: CustomBinder, page: number, slot: number): CustomBinder {
  return b.pages[page]?.[slot] === undefined ? b : withSlot(b, page, slot, null);
}

export function addPage(b: CustomBinder): CustomBinder {
  return b.pages.length >= MAX_PAGES ? b : { ...b, pages: [...b.pages, emptyPage()] };
}

/** Removes a page and the cards on it (they stay in the collection); the last page stays. */
export function removePage(b: CustomBinder, page: number): CustomBinder {
  if (b.pages.length <= 1 || !b.pages[page]) return b;
  return { ...b, pages: b.pages.filter((_, i) => i !== page) };
}

/** Slots ("page:slot") whose card is used more times than it is owned; the earliest slots keep their cards. */
export function missingSlots(b: CustomBinder, collection: Readonly<Record<string, number>>): Set<string> {
  const seen: Record<string, number> = {};
  const out = new Set<string>();
  b.pages.forEach((page, p) =>
    page.forEach((id, s) => {
      if (id === null) return;
      seen[id] = (seen[id] ?? 0) + 1;
      if (seen[id] > (collection[id] ?? 0)) out.add(`${p}:${s}`);
    }),
  );
  return out;
}

export function cardCount(b: CustomBinder): number {
  return b.pages.reduce((n, page) => n + page.filter((id) => id !== null).length, 0);
}
