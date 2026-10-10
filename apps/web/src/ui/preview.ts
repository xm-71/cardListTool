import { create } from 'zustand';
import type { CardInstance } from '@ptcg/engine';

interface PreviewState {
  /** The card opened full size by a long press (the only way to look at a card on a phone). */
  zoomed: CardInstance | null;
  zoom(card: CardInstance | null): void;
}

export const usePreview = create<PreviewState>()((set) => ({
  zoomed: null,
  zoom: (card) => set({ zoomed: card }),
}));
