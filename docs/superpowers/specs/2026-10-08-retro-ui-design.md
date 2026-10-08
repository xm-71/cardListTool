# Retro UI, Title Screen and Pack Animations — Design Spec

Date: 2026-10-08
Status: Draft for review
Mockup: the five-screen sketch shared in chat on 2026-10-08 (title, main menu, intro, pack opening, board).

## 1. Goal

Make the game look and feel like the Game Boy Pokémon TCG games:

- a retro look on **every** screen, including the game board;
- a title screen and a main menu when the game opens;
- a first-launch intro;
- an animated pack opening with sound.

No gameplay, economy or engine rules change. Every existing feature keeps working; only presentation changes, and the intro stores a player name and a default deck.

### What the owner chose

- Style: retro, inspired by the Game Boy TCG games (option C).
- Start: title screen, then a main menu, with a one-time intro (option B).
- Packs: a combination of shake-and-tear, a rarity-scaled reveal, and chiptune sound with a mute toggle.
- Scope: every screen, including the board (option A); the board layout itself stays as it is.
- Approach: our own small retro UI kit (approach 1).

### Assumptions (from the chat; correct if wrong)

- **Card art:** cards stay real card images inside retro frames. Their text is not pixelated.
- **Fonts:** headings, menus and buttons use "Press Start 2P". Longer text (card text, the game log, dialogue) uses the more readable "VT323". Both are free (OFL) and bundled through `@fontsource` packages, so the game needs no font CDN.
- **Palette:** Game Boy Color style, defined as CSS variables in one place:
  - cream background `#f8f0d0`;
  - paper `#fffbe8`;
  - ink `#283040`;
  - accents: red `#d84848`, blue `#3868c0`, yellow `#f0c030`, green `#58a050`, purple `#8060c0`;
  - play mat green stripes.
- **Sound:**
  - generated in code with the Web Audio API, so there are no audio files;
  - starts only after the first click or keypress (which browsers require anyway);
  - mute is a setting, remembered per browser.
- **Reduced motion:** with `prefers-reduced-motion`, animations shorten to simple fades and the screen flash is skipped.

## 2. Screens and flow

```
first launch:  Title → Intro (name → pick deck → 3 tips) → Main menu
later:         Title → Main menu
Main menu:     Duel · Shop · Binder · Decks · Options
Duel:          opponent + decks setup (today's Home picker) → Game board → Game over → Main menu
```

- **Title:**
  - shows a pixel "POKéMON / TRADING CARD GAME" logo, a Poké Ball and a blinking "PRESS START", plus the existing fan-project notice;
  - any click or key continues.
- **Intro** (first launch only, stored in the profile):
  1. "Your name?" — a text field, 1–10 characters, defaulting to "PLAYER".
  2. "Pick the deck you want to start with!" — the three starter decks shown as cards. The choice becomes the default "Your deck" in Duel; it unlocks nothing.
  3. Three dialogue boxes with typewriter text: beat the bots to earn credits; buy packs in the Shop; build decks from playable cards in Decks.
  - Typewriter text completes instantly on click, and a further click advances.
  - A "Skip" button finishes the intro with the defaults.
- **Main menu:**
  - a ▶ cursor menu (mouse hover/click, arrow keys plus Enter/Space);
  - a header with the player name and credits;
  - the default deck's cover card;
  - a rotating tip in a dialogue box;
  - the existing "progress won't be saved" warning.
- **Duel setup:** today's Home choices (opponent, your deck, opponent's deck, Play) in retro boxes, with a "◀ Back" to the menu.
- **Shop, Binder, Decks:** the same content and behaviour as now, restyled, each with "◀ Back".
- **Options:**
  - Sound on/off;
  - change name;
  - "Replay intro".
- **Game board:**
  - same layout and behaviour as now;
  - striped play-mat background and retro frames for slots;
  - HP shown as a pixel bar plus numbers;
  - the action menu and prompts as ▶ menus;
  - the game log in a dialogue-style box;
  - End turn as a chunky button;
  - game over in a retro box with "+N credits".
  - "Quit to home" returns to the main menu.

## 3. Pack opening

The flow stays as it is now: buying saves first, then the reveal starts.

1. **Shake (~0.6 s):** the pack wrapper (a CSS-drawn pack in the set's colours) wobbles. _Sound:_ a rising blip.
2. **Tear (~0.4 s):** the top strip flies off along a dashed line and the pack drops away. _Sound:_ a noise burst ("rip").
3. **Stack:** the 10 cards sit face-down. "Card N / 10" is shown.
4. **Flip** (on tap, Next, Enter or Space): the top card flips with a 3D flip. _Sound:_ a short blip. Then the effect for its rarity tier plays:
   - **Common / Uncommon:** no extra effect.
   - **Rare:** a soft white shine sweeps across the card. _Sound:_ a two-note chime.
   - **Double rare / Ultra Rare:** pixel sparkles burst around the card and a rarity tag pops up. _Sound:_ an arpeggio.
   - **Illustration rare / Special illustration rare / Mega Hyper Rare:** the screen flashes white, a rainbow foil sweeps across the card, more sparkles burst, and a tag ("SPECIAL ILLUSTRATION RARE!") appears. _Sound:_ a fanfare.
5. **"Reveal all":** jumps straight to a grid of all 10 cards. Each card keeps a small static rarity marker. _Sound:_ a single chime.
6. **"Done":** returns to the Shop.

- The tier comes from the card's `rarity` field. One pure function (`rarityTier`) maps rarity to tier, which keeps it testable.
- Animations use CSS keyframes and classes, so no animation library is needed.

## 4. Architecture

All changes are in `apps/web`, plus one small profile addition.

- **Retro UI kit: `src/ui/retro/`**, small components used everywhere:
  - `Box`: a bordered paper panel;
  - `Menu`: a ▶ cursor list with keyboard support, rendered as buttons for accessibility;
  - `Button`;
  - `DialogBox`: typewriter text, with click to complete or advance;
  - `HpBar`;
  - `Header`: name and credits.
- **Theme:** the palette as CSS variables plus Tailwind theme tokens in `index.css`. The fonts are imported once.
- **Navigation:**
  - The app routes between `title | intro | menu | duel | shop | binder | decks | options`, plus the game board when a game is running.
  - The route is held in a small Zustand store, `useNav`, which replaces the current local tab state.
- **Profile:**
  - `Profile` gains `playerName: string | null`, `starterDeck: string | null` and `introDone: boolean`.
  - Profiles saved by M4 lack these fields. Loading fills in `null` / `false`, so existing players see the intro once.
  - New store actions: `finishIntro(name, deck)`, `setName(name)` and `replayIntro()`.
  - All of them go through the same queued `change` as other writes.
- **Settings:**
  - `useSettings` holds `sound: boolean` and is saved in `localStorage`, wrapped in try/catch. This is a per-browser convenience and not part of the profile.
  - The default is sound on, but audio only starts after the first user gesture.
- **Sound: `src/audio/sfx.ts`.**
  - One lazily created `AudioContext`, with tiny square/triangle-wave and noise synths.
  - Named effects: `cursor`, `confirm`, `back`, `shake`, `tear`, `flip`, `rare`, `ultra`, `special`, `win` and `lose`.
  - Every call is a no-op when muted, or when the Web Audio API is missing (as in tests and old browsers).
- **Pack opening:** `src/ui/PackOpening.tsx` becomes a small state machine (`shaking → tearing → stack → flipping(n) → all`), driven by timers and `onAnimationEnd`. With reduced motion, it skips straight from shaking to the stack.

## 5. Testing

- **Unit tests:**
  - `rarityTier` covers every rarity string present in the data;
  - the sfx module is a no-op without `AudioContext` and when muted;
  - settings survive a reload and fall back cleanly when `localStorage` throws;
  - profile migration fills the new fields.
- **Component tests:**
  - **Title:** a key or click goes to the intro on first launch, and to the menu afterwards.
  - **Intro:** name, deck and tips work, and so does Skip. The result is saved, and the chosen deck is the default in Duel.
  - **Menu:** keyboard navigation (arrows plus Enter) opens each screen, and Back returns.
  - **Pack opening:**
    - the phases advance;
    - a special-rarity card adds the flash and its tag;
    - "Reveal all" shows 10 cards;
    - reduced motion skips the shake and tear.
- **Existing tests** keep their behaviour. Selectors that rely on old labels are updated: the Home "Play" button now sits behind Duel, and tabs become menu items.
- **Playwright:**
  - The smoke tests go through title → (skip intro) → menu → Duel, and title → menu → Shop → pack.
  - They capture screenshots of each screen.
- The visual check is done by screenshots in this sandbox (card images don't load here) and on the Vercel preview.

## 6. Out of scope

- A new board layout (only the board's styling changes).
- Music. Only short sound effects are included.
- Pixel-art versions of the card images.
- Sounds during gameplay beyond the game-over jingle and menu blips.
- Online play (M5) and the other deferred items.
