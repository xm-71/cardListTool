import { create } from 'zustand';

export type Route = 'title' | 'intro' | 'menu' | 'duel' | 'gym' | 'shop' | 'binder' | 'decks' | 'options';

/** Which menu screen is showing (the game board takes over while a game runs). */
export const useNav = create<{ route: Route; go(route: Route): void }>()((set) => ({
  route: 'title',
  go: (route) => set({ route }),
}));
