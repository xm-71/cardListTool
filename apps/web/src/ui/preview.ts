import { create } from 'zustand';
import type { CardInstance } from '@ptcg/engine';

interface PreviewState {
  /** The card currently hovered, shown large in the sidebar. */
  card: CardInstance | null;
  show(card: CardInstance | null): void;
  /** The card opened full size by a long press (the only way to look at a card on a phone). */
  zoomed: CardInstance | null;
  zoom(card: CardInstance | null): void;
}

export const usePreview = create<PreviewState>()((set) => ({
  card: null,
  show: (card) => set({ card }),
  zoomed: null,
  zoom: (card) => set({ zoomed: card }),
}));
