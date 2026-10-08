import type { CardScript } from '@ptcg/engine';
import * as me01_121 from './me01/121.ts';
import * as me01_125 from './me01/125.ts';
import * as me01_130 from './me01/130.ts';
import * as me01_131 from './me01/131.ts';
import * as me01_167 from './me01/167.ts';
import * as me01_173 from './me01/173.ts';
import * as me02_094 from './me02/094.ts';
import * as sv01_181 from './sv01/181.ts';

/** Every scripted card, keyed by card name so reprints share one script. */
export const scriptModules: { name: string; script: CardScript }[] = [
  sv01_181,
  me01_167,
  me01_131,
  me01_125,
  me01_173,
  me01_130,
  me01_121,
  me02_094,
];
