import type { CardRegistry } from './cards.ts';
import type { Ruleset } from './ruleset.ts';

/** What every engine module needs besides the state: card definitions/scripts and the rules. */
export interface Env {
  registry: CardRegistry;
  ruleset: Ruleset;
}
