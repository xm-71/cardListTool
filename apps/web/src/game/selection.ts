import type { Action, CardInstance, EnergyType, PlayerId, PlayerView, SlotRef, SlotView } from '@ptcg/engine';
import { actionsForCard, actionsForSlot } from './actions.ts';
import { sameRef, slotAt, topCard, topDef } from './view.ts';

/** What the player has picked on the board: a card in hand or a Pokémon in play. */
export type Selection = { kind: 'hand'; uid: string } | { kind: 'slot'; ref: SlotRef };

export const sameSelection = (a: Selection | null, b: Selection | null): boolean => {
  if (!a || !b || a.kind !== b.kind) return false;
  return a.kind === 'hand' ? a.uid === (b as typeof a).uid : sameRef(a.ref, (b as typeof a).ref);
};

/** Your Active Pokémon, if you have one: what is selected when a turn starts. */
export function defaultSelection(view: PlayerView, viewer: PlayerId): Selection | null {
  return view.you.active ? { kind: 'slot', ref: { player: viewer, zone: 'active' } } : null;
}

export interface PanelAttack {
  index: number;
  name: string;
  cost: EnergyType[];
  /** "30", "20×", or "" for none. */
  damage: string;
  /** The action that uses it, or null when it cannot be used right now. */
  action: Action | null;
}

export interface PanelModel {
  card: CardInstance;
  /** The Pokémon in play when a slot is selected. */
  slot: SlotView | null;
  attacks: PanelAttack[];
  /** Everything else that can be done with the card or Pokémon (not attacks). */
  actions: Action[];
}

/** What the selection panel shows for the selection: the card, its attacks and what can be done. */
export function panelModel(
  view: PlayerView,
  legalActions: Action[],
  selection: Selection | null,
  viewer: PlayerId,
): PanelModel | null {
  if (!selection) return null;
  const legal = view.prompt ? [] : legalActions;
  if (selection.kind === 'hand') {
    const card = view.you.hand.find((c) => c.uid === selection.uid);
    return card ? { card, slot: null, attacks: [], actions: actionsForCard(legal, selection.uid) } : null;
  }
  const slot = slotAt(view, selection.ref);
  if (!slot) return null;
  const { ref } = selection;
  const attacks = topDef(slot).attacks.map((atk, index): PanelAttack => {
    const action =
      ref.player === viewer
        ? (legal.find(
            (a) =>
              a.type === 'attack' &&
              a.attackIndex === index &&
              (ref.zone === 'active' ? a.benchIndex === undefined : a.benchIndex === ref.index),
          ) ?? null)
        : null;
    return {
      index,
      name: atk.name,
      cost: atk.cost,
      damage: atk.damage > 0 ? `${atk.damage}${atk.damageSuffix}` : '',
      action,
    };
  });
  return {
    card: topCard(slot),
    slot,
    attacks,
    actions: actionsForSlot(legal, ref, viewer).filter((a) => a.type !== 'attack'),
  };
}
