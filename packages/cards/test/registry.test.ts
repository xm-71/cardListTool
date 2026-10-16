import { describe, expect, test } from 'vitest';
import type { CardDef, PokemonDef } from '@ptcg/engine';
import { scriptModules } from '../src/scripts/index.ts';
import { isPlayable } from '../src/playable.ts';
import { registry } from './helpers.ts';

/** What a Pokémon does: its attacks and Abilities (the text a script has to implement). */
const behaviour = (d: PokemonDef) =>
  JSON.stringify({
    attacks: d.attacks.map((a) => [a.name, a.cost, a.damage, a.damageSuffix, a.text]),
    abilities: d.abilities.map((a) => [a.name, a.text]),
  });

describe('scripts shared by name', () => {
  test('a Pokémon only runs a script written for a card with the same attacks and Abilities', () => {
    const bad: string[] = [];
    for (const m of scriptModules) {
      const source = registry.defs[m.id] as PokemonDef | undefined;
      if (source?.category !== 'Pokemon') continue;
      for (const d of Object.values(registry.defs) as CardDef[]) {
        if (d.category !== 'Pokemon' || d.id === m.id || registry.scripts[d.id] !== m.script) continue;
        if (behaviour(d) !== behaviour(source)) bad.push(`${d.id} runs the script of ${m.id}`);
      }
    }
    expect(bad).toEqual([]);
  });

  test('a card of the same name with different attacks is not playable by borrowing', () => {
    // Celebi (Stellar Crown) draws a card; the scripted Celebi (Mega Evolution) searches the deck.
    expect(registry.scripts['sv07-004']).toBeUndefined();
    expect(isPlayable(registry.defs['sv07-004']!, registry)).toBe(false);
    // Yamper (Temporal Forces) has different attacks from the scripted one in Phantasmal Flames.
    expect(registry.scripts['sv05-058']).toBeUndefined();
  });

  test('the scripted card itself and true reprints keep their script', () => {
    expect(isPlayable(registry.defs['me01-012']!, registry)).toBe(true); // Celebi, the scripted card
    expect(isPlayable(registry.defs['me01-131']!, registry)).toBe(true); // Ultra Ball (Trainers still borrow by name)
  });

  test('every script module names the card it was written for', () => {
    for (const m of scriptModules) expect(registry.defs[m.id], m.id).toBeDefined();
  });
});
