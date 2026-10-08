# Custom Binders and Collector Mode — Design Spec

Date: 2026-10-08
Status: Draft for review

## 1. Goal

Two additions, both on the collecting side of the game:

1. **Custom binders.** You make your own binders for your favourite cards. They work like real binders, with 9-pocket pages. You decorate each one with colours, a background pattern and stickers.
2. **Collector mode.** An option in Options. While it is on, packs are free and unlimited, and the game is about ripping packs and filling binders.

### What the owner chose

- **Binder contents:** pages with slots. Each page has 9 slots, you put owned cards into specific slots, and slots can be left empty.
- **Images:** built-in stickers and backgrounds. There are no uploads.
- **Collector mode, packs:** free and unlimited.
- **Collector mode, game:** battling is hidden. The menu shows only Shop, Binder and Options. It uses the same collection as normal play.

### Assumptions (approved with the design)

- A binder can hold a card only as many times as you own it. Different binders can each show the same card.
- Stickers and backgrounds are pixel art drawn in code (inline SVG or CSS). There are no image files.
- Today's Binder screen stays as the "All cards" view.
- Binders are saved in the existing profile, on this device. This uses the same queued `change()` as decks and credits.

## 2. Data

### `Profile` additions

```ts
interface CustomBinder {
  id: string; // random id
  name: string; // 1–20 characters, default "My binder"
  coverColor: BinderColor;
  pageColor: BinderColor;
  background: BinderBackground;
  /** Up to 4 stickers in fixed spots on the cover. */
  stickers: Partial<Record<StickerSpot, StickerId>>;
  /** Each page has exactly 9 slots, holding a card id or null. There is always at least 1 page. */
  pages: (string | null)[][];
}
type BinderColor = 'red' | 'blue' | 'yellow' | 'green' | 'purple' | 'ink' | 'cream' | 'pink';
type BinderBackground = 'plain' | 'pokeball' | 'stripes' | 'stars' | 'grid' | 'energy';
type StickerSpot = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
type StickerId = 'pokeball' | 'star' | 'heart' | 'crown' | 'flame' | 'leaf' | 'drop' | 'bolt';
```

- `Profile` gains `binders: CustomBinder[]` and `collectorMode: boolean`.
- **Migration:** profiles saved before this change have neither field. When they load, `normalizeProfile` fills in `binders: []` and `collectorMode: false`. Unknown colours, backgrounds or stickers fall back to the defaults. Pages are padded or trimmed to 9 slots.
- **Limits:** at most 50 binders and at most 40 pages per binder. "New binder" and "Add page" are disabled at the limits.

### Rules (pure functions in `src/profile/binders.ts`)

- **`placementsLeft(binder, cardId, collection)`:** owned copies minus the copies already in this binder.
- **`placeCard(binder, page, slot, cardId, collection)`:** puts a card into a slot.
  - It refuses (no change) when `placementsLeft` is 0.
  - A card moved from another slot of the same binder doesn't count twice.
- **`moveCard(binder, from, to)`:** swaps the two slots.
- **`removeCard(binder, page, slot)`:** empties a slot.
- **`addPage(binder)`** and **`removePage(binder, page)`:**
  - removing a page drops its cards from the binder (they stay in your collection);
  - you can't remove the last page.
- **Owning fewer copies later.** Collections only grow today, but if you later own fewer copies than a binder uses, the extra slots show the card as "missing" (greyed out). Nothing is deleted.

## 3. Binder screen

- **Tabs:** _All cards_ (today's Binder, unchanged) and _My binders_.
- **My binders:** a shelf of binder covers.
  - Each cover is drawn with its colour, background and stickers, plus its name and card count.
  - "New binder" creates one with defaults and opens its cover editor.
- **Open binder:**
  - desktop shows a two-page spread, phone shows one page;
  - each page is a 3×3 grid on the page colour and background;
  - ◀ ▶ buttons and the arrow keys flip pages, and "Page N / M" is shown;
  - "Add page" adds a page;
  - "Remove page" asks you to confirm first.
- **Empty slot:** tap it to open a card picker of owned cards.
  - It has a name search and a set filter, the same filters as All cards.
  - Cards with no placements left are greyed out.
  - Picking a card places it.
- **Filled slot:** tap it to open a small menu: View, Move, Remove.
  - _Move_ highlights the slots; tapping another slot swaps the two.
- **Edit cover:** opened by a button on the binder.
  - You set the name, cover colour, page colour and background, and pick a sticker (or none) for each of the 4 spots.
  - A live preview shows the result.
  - "Delete binder" asks you to confirm first.
- **Styling:** everything uses the retro UI kit (`Box`, `Menu`, `Button`) and the palette tokens. Sticker and background art lives in `src/ui/binder/art.tsx`.

## 4. Collector mode

- **Options:** a "Collector mode" on/off toggle with a one-line explanation. It is saved in the profile.
- **While it is on:**
  - **Main menu:** only Shop, Binder and Options. The deck cover in the menu becomes the cover of your most recently edited binder, or a Poké Ball if you have none. Tips are about collecting.
  - **Shop:**
    - every pack shows "FREE", and buying never checks or spends credits;
    - the credits counter is hidden;
    - packs open with the same animation as today.
  - **Navigation:** a saved route to Duel or Decks (for example from a deep link) goes to the menu instead.
- **Turning it off:** Duel and Decks come back. Credits are exactly what they were before collector mode was turned on.
- **Store action:** `useProfile.setCollectorMode(on)`. `buyPack(setId)` skips the price when `collectorMode` is true, and the price check lives in the same queued `change()`.
- **Intro:** the first-launch intro is unchanged. Collector mode is only switched on from Options.

## 5. Testing

- **Unit (binder rules):**
  - placement respects owned counts;
  - move and swap;
  - remove;
  - adding and removing pages, including the last-page guard and the cards on a removed page;
  - limits;
  - "missing" display when a binder uses more copies than you own.
- **Unit (profile):**
  - old profiles load with `binders: []` and `collectorMode: false`;
  - bad binder fields are normalized;
  - a free pack in collector mode leaves credits unchanged and adds the cards.
- **Component:**
  - creating a binder, editing the cover (preview updates), placing a card from the picker, flipping pages, and deleting with confirmation;
  - collector mode hides Duel and Decks in the menu and shows FREE in the Shop.
- **Playwright:**
  1. Title, then menu.
  2. Turn on collector mode in Options.
  3. Open a free pack in the Shop.
  4. In Binder, open My binders, create a binder and place a pulled card.
  5. Reload the page and check the binder and the card are still there.
  6. Take screenshots of the shelf, the open binder and the cover editor, at desktop and phone widths.

## 6. Out of scope

- Uploading your own images.
- Free placement of stickers (they go in fixed spots only).
- Want-lists of unowned cards.
- Sharing binders.
- Sorting binders automatically.
- A separate collection for collector mode.
