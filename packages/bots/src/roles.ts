import type { PokemonDef, TrainerDef } from '@ptcg/engine';

export type TrainerRole = 'gust' | 'switch' | 'draw' | 'search' | 'evolve' | 'other';

/** What a Trainer is for, read from its card text. */
export function trainerRole(def: TrainerDef): TrainerRole {
  const t = def.text;
  if (/switch in 1 of your opponent['’]s benched/i.test(t)) return 'gust';
  if (/switch your active pok[eé]mon with/i.test(t)) return 'switch';
  if (def.name === 'Rare Candy' || /stage 2 card in your hand/i.test(t)) return 'evolve';
  if (def.trainerType === 'Supporter' && /\bdraw/i.test(t)) return 'draw';
  if (/search your deck|look at the top|from your discard pile into your hand/i.test(t)) return 'search';
  return 'other';
}

/** A Pokémon whose Ability draws or searches: worth Benching early and fetching. */
export function isSupportPokemon(def: PokemonDef): boolean {
  return def.abilities.some((a) => /\bdraw|search your deck|look at the top/i.test(a.text));
}
