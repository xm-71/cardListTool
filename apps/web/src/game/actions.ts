import type { Action, PlayerId, PlayerView, SlotRef } from '@ptcg/engine';
import { defOf, sameRef, slotAt, topDef, visibleCards } from './view.ts';

/** A short human-readable label for a legal action, from the acting player's view. */
export function describeAction(a: Action, view: PlayerView): string {
  const cards = visibleCards(view);
  const name = (uid: string) => {
    const c = cards.get(uid);
    return c ? defOf(c).name : 'a card';
  };
  const slotName = (ref: SlotRef) => {
    const slot = slotAt(view, ref);
    return slot ? topDef(slot).name : 'a Pokémon';
  };
  switch (a.type) {
    case 'playBasic':
      return `Play ${name(a.uid)}`;
    case 'playTrainer':
      return a.target ? `Attach ${name(a.uid)} to ${slotName(a.target)}` : `Play ${name(a.uid)}`;
    case 'attachEnergy':
      return `Attach ${name(a.uid)} to ${slotName(a.target)}`;
    case 'evolve':
      return `Evolve ${slotName(a.target)} into ${name(a.uid)}`;
    case 'retreat': {
      const slot = view.you.bench[a.benchIndex];
      return `Retreat to ${slot ? topDef(slot).name : 'a Benched Pokémon'}`;
    }
    case 'attack': {
      const active = view.you.active;
      const atk = active ? topDef(active).attacks[a.attackIndex] : undefined;
      if (!atk) return 'Attack';
      return atk.damage > 0
        ? `Attack: ${atk.name} (${atk.damage}${atk.damageSuffix})`
        : `Attack: ${atk.name}`;
    }
    case 'useAbility':
      return `Use ${a.ability}`;
    case 'useStadium':
      return `Use ${view.stadium ? defOf(view.stadium.card).name : 'Stadium'}`;
    case 'endTurn':
      return 'End turn';
    case 'concede':
      return 'Concede';
    case 'answer': {
      if (a.optionId === 'done') return 'Done';
      return view.prompt?.options.find((o) => o.id === a.optionId)?.label ?? a.optionId;
    }
  }
}

/** Actions that play or use a specific card from the hand. */
export function actionsForCard(legal: Action[], uid: string): Action[] {
  return legal.filter((a) => 'uid' in a && a.uid === uid);
}

/** Actions aimed at a Pokémon in play: things played onto it, its Ability, and (for the Active) attacks and retreat. */
export function actionsForSlot(legal: Action[], ref: SlotRef, actor: PlayerId): Action[] {
  return legal.filter((a) => {
    switch (a.type) {
      case 'evolve':
      case 'attachEnergy':
        return sameRef(ref, a.target);
      case 'playTrainer':
        return !!a.target && sameRef(ref, a.target);
      case 'useAbility':
        return sameRef(ref, a.slot);
      case 'attack':
      case 'retreat':
        return ref.zone === 'active' && ref.player === actor;
      default:
        return false;
    }
  });
}

/** Actions not tied to one card: end turn, Stadium effect, concede. */
export function globalActions(legal: Action[]): Action[] {
  return legal.filter((a) => a.type === 'endTurn' || a.type === 'useStadium' || a.type === 'concede');
}
