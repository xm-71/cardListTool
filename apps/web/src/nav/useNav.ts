import { create } from 'zustand';

export type Route =
  | 'title'
  | 'intro'
  | 'menu'
  | 'duel'
  | 'gym'
  | 'frontier'
  | 'shop'
  | 'binder'
  | 'decks'
  | 'deckcase'
  | 'options';

interface Nav {
  route: Route;
  /** Where Back and "Use this deck" go from the Deck Case: the screen that opened it. */
  returnTo: Route | null;
  go(route: Route, returnTo?: Route): void;
  /** Back to `returnTo` (or the menu) and forget it. */
  leave(): void;
}

/** Which menu screen is showing (the game board takes over while a game runs). */
export const useNav = create<Nav>()((set, get) => ({
  route: 'title',
  returnTo: null,
  go: (route, returnTo) => set({ route, returnTo: returnTo ?? null }),
  leave: () => set({ route: get().returnTo ?? 'menu', returnTo: null }),
}));
