# Backlog

Ideas and follow-ups agreed with the player but not scheduled yet. Newest at the top.

- **Code base review follow-ups** (`docs/reviews/2026-11-12-code-base-review.md`), most costly first: split the 7 MB
  card data out of the app and bot-worker bundles; build the app and run the end-to-end tests in CI, with a phone
  viewport; fail when two unscoped card scripts share a name or a Pokémon script has no `set`; generate
  `scripts/index.ts`; one deck catalogue shared by the web app and the bot scripts; machine-readable prompt kinds so
  the smart bot stops matching English text; React-hooks and accessibility lint rules; shared chip/tab components and
  named text sizes; move large data tables out of TypeScript; hidden source maps. (2026-11-12)
- **Design fixes** (`docs/superpowers/plans/2026-11-12-design-fixes.md`): 15 findings from the visual and UX review,
  ready to hand off. (2026-11-12)
- **Johto and Blue/Red leaders below their probe bands** (from #50): Karen 52%, Johto Koga 31%, Johto Bruno 43%, Johto
  Lance 35% (band 60-70, Lance 65-75), Blue Grass 48%, Red 46%. Decks stall (27-40 turn medians); also the Raging Bolt ex
  Bellowing Thunder case where the bot attacks for 0 with exactly {L}{F} on the Active. (2026-11-12)
- **Meta deck deferred minors** (from #50): Crown Opal (Terapagos ex) also blocks Basic {C} attackers; the me02.5-179
  Terapagos reprint is unscripted; Frenzied Gouging scored lethal against `preventEffects`; bots never pick Terminal
  Period; bots rank the opponent's cards by their own `wantScore` for Pincers and Claw of Darkness. (2026-11-12)
- **Make every card of the imported sets playable.** Sets imported whole for the leader meta decks (Scarlet & Violet,
  Mega Evolution) are in the collection and the shop, but only the cards those decks use are scripted; the rest show
  "isn't playable yet" in the deck builder. Script the remaining cards set by set. (2026-10-16)
- **V / VMAX / VSTAR in the engine** (Gym difficulty spec 2): card stages, Prize values (V 2, VMAX 3, VSTAR 2), the
  once-per-game VSTAR Power, and importing Sword & Shield sets. (2026-10-16)
- **Sword & Shield meta decks** (Gym difficulty spec 3): Lugia, Arceus, Palkia, Mew VMAX, Regidrago and others, after
  spec 2. (2026-10-16)
- **Smart bots, deferred minors** (from #43): take a second Energy from "up to 2 Energy" searches; choose the best
  attack on "Use which attack?"; play Switch cards and retreat a Pokémon about to be Knocked Out; bench only what the
  deck plan needs. (2026-10-16)
- **Accounts part 4b: cloud sync** (Tasks 6–10 of `docs/superpowers/plans/2026-10-14-account-saves.md`).
- **Town building art** with CC0 asset packs (needs its own spec).
