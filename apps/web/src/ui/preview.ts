import { create } from 'zustand';
import type { CardInstance } from '@ptcg/engine';

/** The card currently hovered, shown large in the sidebar. */
export const usePreview = create<{ card: CardInstance | null; show(card: CardInstance | null): void }>()(
  (set) => ({
    card: null,
    show: (card) => set({ card }),
  }),
);
