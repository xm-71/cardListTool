# More card packs — research and design

Date: 2026-10-09
Status: Draft for review (research done; nothing built yet)

## 1. What the owner chose

- **Sets first:** vintage and classic sets (not the modern Standard sets).
- **Playability:** collect-only at first, like Base Set. Cards become playable later, as they get scripts.
- **Packs:** era-accurate layouts (card counts and slots match each era's real packs).
- **Size:** keep it simple. All card data is bundled; "Download all art" gets one button per era or set.

## 2. Research findings

### Sets (TCGdex has data and art for every card; the importer already works from `src/sets.json`)

| Group                | Sets                                                                                       | Cards            |
| -------------------- | ------------------------------------------------------------------------------------------ | ---------------- |
| Rest of Wizards      | Neo Discovery `neo2`, Neo Revelation `neo3`, Neo Destiny `neo4`, Legendary Collection `lc` | 75, 64, 105, 110 |
| e-Card               | Expedition `ecard1`, Aquapolis `ecard2`, Skyridge `ecard3`                                 | 165, 147, 144    |
| EX                   | `ex1`–`ex16` (Ruby & Sapphire to Power Keepers)                                            | about 1,700      |
| Diamond & Pearl      | `dp1`–`dp7`                                                                                | about 840        |
| Platinum             | `pl1`–`pl4`                                                                                | about 480        |
| HeartGold SoulSilver | `hgss1`–`hgss4`, Call of Legends `col1`                                                    | about 500        |

Not sold as packs: promos, trainer kits, POP series, McDonald's sets and the Shiny Vault sub-sets.

### Pack layouts (needs checking against Bulbapedia's set pages while building)

- **Wizards era (existing):** 11 cards: 7 Common, 3 Uncommon, 1 Rare.
- **e-Card and EX:** 9 cards (Bulbapedia). The slot split is not stated there; it is believed to be 5 Common, 3 Uncommon, 1 Rare, with one Common possibly replaced by a Reverse Holo. EX packs may also carry a Basic Energy. To confirm per set.
- **Diamond & Pearl and Platinum:** 10 cards: 5 Common, 3 Uncommon, 1 Reverse Holo, 1 Rare or Holo Rare (Bulbapedia).
- **HeartGold SoulSilver and Call of Legends:** 10 cards (Japanese packs: 8 Common/Uncommon, a Basic Energy, a Reverse Holo and a Holo). The English split is to be confirmed.
- **Rarity names** in TCGdex for these eras are mostly "Common", "Uncommon", "Rare", "Holo Rare" plus a few special names (for example "Holo Rare ex", "Rare Prime", "LEGEND"); the exact list per set is produced by a survey script during the build and must be mapped in the pack generator. Any rarity left out of every slot would make those cards impossible to pull.

### Code that changes

- **Normalizer** (`packages/cards/src/normalize.ts`): throws on stages other than Basic, Stage 1 and Stage 2. These eras add `LEGEND`, `BREAK`, `Restored`, `Baby`, `Level-Up`, and some cards have no stage. Each needs a mapping (collect-only cards just need to load and display). Also check the Trainer sub-types these eras use.
- **Energy types:** the engine has no Fairy type, but none of these sets use it (Fairy starts in XY), so nothing to change now. Dragon and Metal exist.
- **Packs** (`packages/economy/src/packs.ts`): `PackDef.era` has `mega`, `classic` and `sv`. Add layouts as data (slots with a rarity pool each) instead of one hard-coded function per era, so each era is a table and a test.
- **Sets** (`packages/cards/src/sets.ts`): the `Era` type and the `CLASSIC` list grow; new sets default to collect-only (not playable, hidden from "Playable" badges).
- **Shop and Binder:** about 40 more packs need a filter by era and a search, and must work at phone width. The Binder's set picker needs the same.
- **Offline art:** `artUrls` already lists every card. Add per-era and per-set download buttons, with sizes (about 80 MB per 1,000 cards for both image sizes).
- **Size:** about 0.6 KB per card raw (64 B gzipped). 4,000 more cards is about +250 KB gzipped, and the bot worker bundles the data again. Acceptable for now; lazy-loading card data per set is the fallback if load time becomes a problem.

## 3. Plan (each phase is its own PR, deployed before the next)

1. **Foundations and Wizards leftovers:** normalizer mappings, data-driven pack layouts, Shop and Binder filters, per-set art download; add Neo 2–4 and Legendary Collection.
2. **e-Card and EX:** 19 sets, 9-card layouts (verify the slot split from set pages first).
3. **Diamond & Pearl, Platinum, HeartGold SoulSilver, Call of Legends:** 10-card layouts with a Reverse Holo slot.

Each phase: import and survey the data (card counts, stages, rarities), add pack layouts with unit tests on every rarity being reachable, extend the pack fuzz tests, check the Shop and Binder at phone width, and run the offline art download test.

## 4. Open questions for the build

- Exact slot split and rarity names per set (survey script plus Bulbapedia).
- Pack prices: keep 150 for all, or price older and rarer sets differently?
- Whether legendary-collection style reverse-holo reprints need their own pack rules.
