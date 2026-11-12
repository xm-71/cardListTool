# Code base review (2026-11-12)

Scope: the whole repository at `a91acdd`. Method: structure, configuration, the largest files and the shared
mechanisms were read; the 278 card scripts and most UI components were sampled, not read one by one. Numbers below
were measured on that commit. Nothing was changed.

## Shape

| Package | Role | Source | Test files |
|---|---|---|---|
| `packages/engine` | Rules engine: state, actions, effects, views. Depends on nothing. | 21 files | 16 |
| `packages/cards` | Card data (TCGdex import), card scripts, deck lists, registry. Depends on engine. | 278 files | 56 |
| `packages/economy` | Packs, deck rules, rewards. Depends on cards, engine. | 4 files | 5 |
| `packages/bots` | Easy/medium/hard bot policies, balance scripts. Depends on cards, engine. | 15 files | 16 |
| `apps/web` | React app (screens, UI, profile, cloud saves, offline). Depends on all four. | 134 files, ~13,300 lines | 90 + 10 e2e specs |

## What is in good shape

- **Dependencies point one way** (engine ← cards ← economy/bots ← web); no cycles, and the engine has no imports
  from the others.
- **Strict TypeScript** (`strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`). Only 4 escape hatches
  (`any`, `@ts-ignore`, `eslint-disable`) in all source, and no TODO/FIXME comments.
- **Tests**: 173 test files, 1817 tests, all passing; CI runs typecheck, lint and tests on every push.
- **Determinism**: no `Math.random` or `Date.now` in any package's source; games are seeded, which is what makes the
  bot probes repeatable.
- **Cloud saves**: the one Supabase table has row-level security with own-row policies; the browser reads only the
  public URL and anon/publishable key (`apps/web/src/cloud/config.ts`, `vite.config.ts` `envPrefix`).
- **Process**: every feature has a spec and a plan under `docs/superpowers`.

## Findings

Ordered by how much they are likely to cost.

### 1. The app ships about 10 MB of JavaScript, mostly card data, twice (high)

`packages/cards/src/data/cards.json` is 7.0 MB (8,329 cards) and is imported statically by `registry.ts` and
`sets.ts`. The last production build has `index-*.js` at 5.36 MB and `bot.worker-*.js` at 4.87 MB: the data is in
both, and the service worker precaches both. Most of those cards are collect-only and are never needed by the
engine or the bot.

Suggested: split the data by need. The engine and the bot worker need only the playable cards' definitions (a few
hundred); the Binder and Shop can load each set's display data on demand (`import()` per set or a fetched JSON).
Measure first-load size before and after.

### 2. CI does not build the app or run the end-to-end tests (high)

`.github/workflows/ci.yml` runs `typecheck`, `lint`, `test`. `vite build` and the 10 Playwright specs in
`apps/web/e2e` run only by hand. A build-only failure is caught by Vercel after the push; an e2e regression is not
caught at all. The Playwright config also tests one viewport (1400×950), so nothing checks phone layouts.

Suggested: add `pnpm --filter @ptcg/web build` and the e2e suite to CI, and a phone project in
`playwright.config.ts`.

### 3. Card scripts are registered by name, and the last one wins (medium; has already caused a bug)

`buildRegistry` (`packages/cards/src/registry.ts`) keys a script without `set` by card name. Two scripts for the
same name silently replace each other; in PR #49 a new Charmander script replaced the one a theme deck used. The
working rule "every new Pokémon script exports `set`" is only a convention.

Suggested: make it an error at registry build time (or in a test) when two unscoped modules share a name, and when
a Pokémon script has no `set`.

### 4. `scripts/index.ts` is a hand-kept list of 271 imports (medium)

`packages/cards/src/scripts/index.ts` (549 lines) must be edited for every new script, in two places. A missed
line means a card silently has no script.

Suggested: generate the file (a small script run by the import step) or use `import.meta.glob`, plus a test that
every file under `scripts/<set>/` is registered.

### 5. Adding a deck means editing several lists by hand (medium)

`CLAUDE.md` has to remind contributors to add each new deck to `apps/web/src/game/catalog.ts` and three files in
`packages/bots`. `catalog.ts` also keeps a hand-written `DeckId` union and import list.

Suggested: one exported deck catalogue in `packages/cards` (id, name, kind) that the web app, the round-robin script
and the fuzz tests all read.

### 6. The smart bot reads English text to decide (medium)

`packages/bots/src/smart.ts` (695 lines, the largest logic file) matches card text and prompt messages with regular
expressions in 7 places, for example `"(\d+) damage each"` in a prompt message and `"knock out your opponent's
active pok"` in attack text. A reworded prompt in a card script changes bot behaviour with no type error. The file
also mixes reading the board, scoring, and answering prompts.

Suggested: give prompts a small machine-readable `kind`/`meta` field (the engine's prompt type already carries
options) and have scripts set it; split `smart.ts` into reader, attack choice and prompt answers.

### 7. Lint has no React or accessibility rules (medium)

`eslint.config.js` is `typescript-eslint` recommended only. There is no `eslint-plugin-react-hooks` (stale effect
dependencies go unnoticed) and no `jsx-a11y`. The design review of the same date found accessible names that differ
from visible labels and controls under 44px; lint rules would catch part of that class.

### 8. Styling is repeated utility strings with arbitrary sizes (low)

A `Button` component exists (`ui/retro/Button.tsx`), yet tabs, chips and several buttons re-type the same class
string, and pixel-font sizes are spread over `text-[5px]` to `text-[11px]` in about 125 places. This is why the
design review found seven different small sizes.

Suggested: a `Chip`/`Tab` component and three named text sizes in the theme.

### 9. Large data-as-code files in the web app (low)

`game/portraits.ts` (748 lines) and `game/gym.ts` (662 lines) are data tables in TypeScript, and
`profile/useProfile.ts` (540 lines) holds the whole save model and its actions. They work, but each change touches
a very large file. Moving the tables to JSON (validated on load) and splitting the profile store by concern would
make reviews smaller.

### 10. Production source maps are public (low)

`vite.config.ts` sets `build.sourcemap: true`, so the full source is downloadable from the deployed site. That is a
deliberate choice for bug reports and the project is private-by-obscurity, but it is worth knowing; hidden source
maps uploaded to an error tracker would give the same benefit.

## Not reviewed

Individual card scripts for rules accuracy (they have per-card tests), the Supabase project's settings outside the
migration file, and runtime performance on a real phone.
