import { describe, expect, test } from 'vitest';
import type { PokemonDef, TrainerDef } from '@ptcg/engine';
import { buildRegistry } from '@ptcg/cards';
import { isSupportPokemon, trainerRole } from '../src/roles.ts';

const registry = buildRegistry();
const role = (id: string) => trainerRole(registry.defs[id] as TrainerDef);

describe('card roles', () => {
  test('classifies staple Trainers', () => {
    expect(['me01-131', 'sv01-181', 'me01-167', 'sv01-166', 'sv10.5b-084', 'me01-173'].map(role)).toEqual(
      Array(6).fill('search'),
    ); // Ultra Ball, Nest Ball, Poffin, Arven, Pokégear, Night Stretcher
    expect(['sv02-185', 'sv09-155', 'me01-119'].map(role)).toEqual(['draw', 'draw', 'draw']); // Iono, Research, Lillie's
    expect(['me01-114', 'sv05-157'].map(role)).toEqual(['gust', 'gust']); // Boss's Orders, Prime Catcher
    expect(role('me01-130')).toBe('switch');
    expect(role('me01-125')).toBe('evolve'); // Rare Candy
  });
  test('support Pokémon have a draw or search Ability', () => {
    expect(isSupportPokemon(registry.defs['sv06.5-038'] as PokemonDef)).toBe(true); // Fezandipiti ex
    expect(isSupportPokemon(registry.defs['sv06-130'] as PokemonDef)).toBe(false); // Dragapult ex
  });
});
