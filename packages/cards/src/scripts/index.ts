import type { CardScript } from '@ptcg/engine';
import * as me01_114 from './me01/114.ts';
import * as me01_119 from './me01/119.ts';
import * as me01_122 from './me01/122.ts';
import * as me01_127 from './me01/127.ts';
import * as me01_132 from './me01/132.ts';
import * as me01_166 from './me01/166.ts';
import * as me02_092 from './me02/092.ts';
import * as sv01_166 from './sv01/166.ts';
import * as sv02_185 from './sv02/185.ts';
import * as sv09_155 from './sv09/155.ts';
import * as me02_056 from './me02/056.ts';
import * as me02_059 from './me02/059.ts';
import * as me02_062 from './me02/062.ts';
import * as me02_067 from './me02/067.ts';
import * as me02_068 from './me02/068.ts';
import * as me02_069 from './me02/069.ts';
import * as me01_062 from './me01/062.ts';
import * as me01_063 from './me01/063.ts';
import * as me02_039 from './me02/039.ts';
import * as me02_040 from './me02/040.ts';
import * as me02_041 from './me02/041.ts';
import * as me02_042 from './me02/042.ts';
import * as me02_043 from './me02/043.ts';
import * as me02_044 from './me02/044.ts';
import * as me02_045 from './me02/045.ts';
import * as me01_116 from './me01/116.ts';
import * as me01_124 from './me01/124.ts';
import * as sv06_163 from './sv06/163.ts';
import * as sv08_177 from './sv08/177.ts';
import * as sv08_187 from './sv08/187.ts';
import * as sv09_149 from './sv09/149.ts';
import * as me01_073 from './me01/073.ts';
import * as me01_074 from './me01/074.ts';
import * as me01_075 from './me01/075.ts';
import * as me01_076 from './me01/076.ts';
import * as me01_077 from './me01/077.ts';
import * as sv06_141 from './sv06/141.ts';
import * as sv06_5_038 from './sv06.5/038.ts';
import * as me01_121 from './me01/121.ts';
import * as me01_125 from './me01/125.ts';
import * as me01_130 from './me01/130.ts';
import * as me01_131 from './me01/131.ts';
import * as me01_167 from './me01/167.ts';
import * as me01_173 from './me01/173.ts';
import * as me02_094 from './me02/094.ts';
import * as sv01_181 from './sv01/181.ts';
import * as me02_011 from './me02/011.ts';
import * as me02_013 from './me02/013.ts';
import * as me02_018 from './me02/018.ts';
import * as me02_014 from './me02/014.ts';
import * as me01_025 from './me01/025.ts';
import * as me01_031 from './me01/031.ts';
import * as me01_001 from './me01/001.ts';
import * as me01_003 from './me01/003.ts';
import * as me01_004 from './me01/004.ts';
import * as me01_005 from './me01/005.ts';
import * as me01_011 from './me01/011.ts';
import * as me01_012 from './me01/012.ts';
import * as me01_032 from './me01/032.ts';
import * as me01_036 from './me01/036.ts';
import * as me02_026 from './me02/026.ts';
import * as me01_034 from './me01/034.ts';
import * as me01_044 from './me01/044.ts';
import * as me01_049 from './me01/049.ts';
import * as me01_050 from './me01/050.ts';
import * as me01_048 from './me01/048.ts';
import * as me02_030 from './me02/030.ts';
import * as me02_031 from './me02/031.ts';
import * as me01_046 from './me01/046.ts';
import * as me01_104 from './me01/104.ts';
import * as me01_106 from './me01/106.ts';
import * as me01_112 from './me01/112.ts';
import * as me02_081 from './me02/081.ts';
import * as me02_082 from './me02/082.ts';
import * as me02_106 from './me02/106.ts';
import * as me01_107 from './me01/107.ts';
import * as me02_084 from './me02/084.ts';
import * as me01_108 from './me01/108.ts';
import * as me02_076 from './me02/076.ts';
import * as me02_077 from './me02/077.ts';

/** Every scripted card, keyed by card name so reprints share one script. */
export const scriptModules: { name: string; script: CardScript }[] = [
  me02_077,
  me02_076,
  me01_108,
  me02_084,
  me01_107,
  me02_106,
  me02_082,
  me02_081,
  me01_112,
  me01_106,
  me01_104,
  me01_046,
  me02_031,
  me02_030,
  me01_048,
  me01_050,
  me01_049,
  me01_044,
  me01_034,
  me02_026,
  me01_036,
  me01_032,
  me01_012,
  me01_011,
  me01_005,
  me01_004,
  me01_003,
  me01_001,
  me02_011,
  me02_013,
  me02_018,
  me02_014,
  me01_025,
  me01_031,
  sv01_181,
  me01_167,
  me01_131,
  me01_125,
  me01_173,
  me01_130,
  me01_121,
  me02_094,
  me01_114,
  me01_119,
  me01_122,
  me01_127,
  me01_132,
  me01_166,
  me02_092,
  sv01_166,
  sv02_185,
  sv09_155,
  me02_056,
  me02_059,
  me02_062,
  me02_067,
  me02_068,
  me02_069,
  me01_062,
  me01_063,
  me02_039,
  me02_040,
  me02_041,
  me02_042,
  me02_043,
  me02_044,
  me02_045,
  me01_116,
  me01_124,
  sv06_163,
  sv08_177,
  sv08_187,
  sv09_149,
  me01_073,
  me01_074,
  me01_075,
  me01_076,
  me01_077,
  sv06_141,
  sv06_5_038,
];
