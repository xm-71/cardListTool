# Pokémon TCG — browser game

A private, browser-based Pokémon Trading Card Game for friends: play real matches under
2026–27 Standard rules against bots or each other online, earn credits from bot matches,
open packs, and build decks from your collection.

> **Private use only.** Pokémon names, card text and art belong to Nintendo / Creatures /
> GAME FREAK / The Pokémon Company. This project is not affiliated with them and is not
> published, sold or advertised.

Design: [`docs/superpowers/specs/`](docs/superpowers/specs/) · Plans: [`docs/superpowers/plans/`](docs/superpowers/plans/)

## Layout

| Package           | What it is                                                     |
| ----------------- | -------------------------------------------------------------- |
| `packages/engine` | Pure rules engine (no DOM, no network, seeded randomness)      |
| `packages/cards`  | Card data imported from TCGdex, decklists, card effect scripts |
| `packages/bots`   | Bot players and a match runner                                 |

## Development

Requires Node 22+ and pnpm 10.

```bash
pnpm install
pnpm test        # all tests
pnpm typecheck
pnpm lint
```
