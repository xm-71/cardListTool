import { ENERGY_TYPES, type AttackDef, type CardDef, type EnergyType } from '@ptcg/engine';

interface RawAttack {
  name: string;
  cost?: string[];
  damage?: number | string;
  effect?: string;
}

interface RawCard {
  id: string;
  name: string;
  category: string;
  image?: string;
  rarity?: string;
  regulationMark?: string;
  hp?: number;
  types?: string[];
  evolveFrom?: string;
  stage?: string;
  abilities?: { name: string; effect?: string }[];
  attacks?: RawAttack[];
  weaknesses?: { type: string }[];
  resistances?: { type: string }[];
  retreat?: number;
  trainerType?: string;
  energyType?: string;
  effect?: string;
}

export function parseDamage(raw: number | string | undefined): Pick<AttackDef, 'damage' | 'damageSuffix'> {
  if (raw === undefined || raw === '') return { damage: 0, damageSuffix: '' };
  if (typeof raw === 'number') return { damage: raw, damageSuffix: '' };
  if (raw.trim() === '?') return { damage: 0, damageSuffix: '?' };
  const m = /^(\d+)\s*([+×x-]?)$/.exec(raw.trim());
  if (!m) throw new Error(`Unparseable damage: ${raw}`);
  const suffix = m[2] === 'x' ? '×' : (m[2] as '' | '+' | '×' | '-' | '?');
  return { damage: Number(m[1]), damageSuffix: suffix };
}

function energyType(raw: string): EnergyType {
  if (!(ENERGY_TYPES as readonly string[]).includes(raw)) throw new Error(`Unknown energy type: ${raw}`);
  return raw as EnergyType;
}

/** TCGdex has no pictures for some Basic Energy printings (e.g. Mega Evolution Energy); borrow Crown Zenith's. */
const BASIC_ENERGY_ART: Partial<Record<EnergyType, string>> = {
  Grass: '152',
  Fire: '153',
  Water: '154',
  Lightning: '155',
  Psychic: '156',
  Fighting: '157',
  Darkness: '158',
  Metal: '159',
};

export function normalizeTcgdexCard(input: unknown): CardDef {
  const raw = input as RawCard;
  const base = {
    id: raw.id,
    name: raw.name,
    regulationMark: raw.regulationMark ?? null,
    rarity: raw.rarity ?? 'Unknown',
    image: raw.image ?? '',
  };
  switch (raw.category) {
    case 'Pokemon': {
      const isEx = raw.name.endsWith(' ex');
      const stage = raw.stage ?? 'Basic';
      if (stage !== 'Basic' && stage !== 'Stage1' && stage !== 'Stage2') {
        throw new Error(`Unsupported stage ${stage} on ${raw.id}`);
      }
      return {
        ...base,
        category: 'Pokemon',
        stage,
        hp: raw.hp ?? 0,
        types: (raw.types ?? []).map(energyType),
        evolvesFrom: raw.evolveFrom ?? null,
        weakness: raw.weaknesses?.[0] ? energyType(raw.weaknesses[0].type) : null,
        resistance: raw.resistances?.[0] ? energyType(raw.resistances[0].type) : null,
        retreat: raw.retreat ?? 0,
        attacks: (raw.attacks ?? []).map((a) => ({
          name: a.name,
          cost: (a.cost ?? []).map(energyType),
          ...parseDamage(a.damage),
          text: a.effect ?? '',
        })),
        abilities: (raw.abilities ?? []).map((a) => ({ name: a.name, text: a.effect ?? '' })),
        isEx,
        isMega: isEx && raw.name.startsWith('Mega '),
      };
    }
    case 'Trainer': {
      // Classic (WotC-era) Trainers have no sub-type: they behave like Items.
      const t = raw.trainerType ?? 'Item';
      if (t !== 'Item' && t !== 'Supporter' && t !== 'Stadium' && t !== 'Tool') {
        throw new Error(`Unsupported trainer type ${t} on ${raw.id}`);
      }
      return {
        ...base,
        category: 'Trainer',
        trainerType: t,
        text: raw.effect ?? '',
        isAceSpec: raw.rarity === 'ACE SPEC Rare',
      };
    }
    case 'Energy': {
      const basicType = raw.name.replace(/^Basic /, '').replace(/ Energy$/, '');
      // TCGdex labels some Special Energy (e.g. Ignition Energy) as 'Normal'; only a real type name is Basic.
      const basic = raw.energyType === 'Normal' && (ENERGY_TYPES as readonly string[]).includes(basicType);
      const provides = raw.types?.length
        ? raw.types.map(energyType)
        : basic
          ? [energyType(basicType)]
          : ['Colorless' as const];
      const art = basic && !base.image ? BASIC_ENERGY_ART[provides[0]!] : undefined;
      return {
        ...base,
        ...(art ? { image: `https://assets.tcgdex.net/en/swsh/swsh12.5/${art}` } : {}),
        category: 'Energy',
        energyKind: basic ? 'Basic' : 'Special',
        provides,
        text: raw.effect ?? '',
      };
    }
    default:
      throw new Error(`Unknown card category ${raw.category} on ${raw.id}`);
  }
}
