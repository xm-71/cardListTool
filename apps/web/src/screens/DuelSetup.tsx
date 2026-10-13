import { useMemo, useState } from 'react';
import { validateCustomDeck } from '@ptcg/economy';
import { sfx } from '../audio/sfx.ts';
import { deckSources, ownedDeckSources, registry } from '../game/catalog.ts';
import { useGame } from '../game/store.ts';
import { ScreenFrame } from '../nav/ScreenFrame.tsx';
import { useProfile } from '../profile/useProfile.ts';
import { DeckChoice } from '../ui/DeckChoice.tsx';
import { Box, Button } from '../ui/retro/index.ts';

type Opponent = 'easy' | 'medium' | 'hard' | 'hotseat';

const OPPONENTS = [
  ['easy', 'Easy bot'],
  ['medium', 'Medium bot'],
  ['hard', 'Hard bot'],
  ['hotseat', 'Hotseat (2 players, 1 device)'],
] as const;

/** Choose the opponent and both decks, then start a game. */
export function DuelSetup() {
  const start = useGame((s) => s.start);
  const [opponent, setOpponent] = useState<Opponent>('easy');
  const customDecks = useProfile((s) => s.profile.decks);
  const collection = useProfile((s) => s.profile.collection);
  const starter = useProfile((s) => s.profile.starterDeck);
  const ownedDecks = useProfile((s) => s.profile.ownedDecks);
  // Custom decks that no longer validate (e.g. a card's playable status changed) are left out.
  const validCustom = useMemo(
    () =>
      customDecks.filter(
        (d) => validateCustomDeck({ name: d.name, cards: d.cards }, registry, collection).length === 0,
      ),
    [customDecks, collection],
  );
  // The player plays the decks they own; a hotseat friend can take any premade deck.
  const decks = useMemo(() => ownedDeckSources(ownedDecks, validCustom), [ownedDecks, validCustom]);
  const allDecks = useMemo(() => deckSources(validCustom), [validCustom]);
  const [pickedMine, setMine] = useState(starter ?? 'mega-gengar');
  const mine = decks.some((d) => d.id === pickedMine) ? pickedMine : (decks[0]?.id ?? pickedMine);
  const [theirs, setTheirs] = useState('mega-diancie');
  const hotseat = opponent === 'hotseat';
  const listOf = (id: string, among = decks) => (among.find((d) => d.id === id) ?? among[0]!).list;
  // Bots play a random starter, theme or meta deck: every premade deck, owned by the player or not.
  const botPool = allDecks.filter((d) => d.kind !== 'custom');
  const play = () => {
    sfx('confirm');
    start({
      mode: hotseat ? 'hotseat' : 'bot',
      difficulty: hotseat ? undefined : opponent,
      humanDeck: listOf(mine),
      botDeck: hotseat ? listOf(theirs, allDecks) : botPool[Math.floor(Math.random() * botPool.length)]!.list,
      seed: (Date.now() ^ Math.floor(Math.random() * 2 ** 31)) >>> 0,
    });
  };
  return (
    <ScreenFrame>
      <Box title="Opponent">
        <fieldset className="flex flex-wrap gap-x-6 gap-y-3">
          <legend className="sr-only">Opponent</legend>
          {OPPONENTS.map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-xl">
              <input
                type="radio"
                name="opponent"
                checked={opponent === value}
                onChange={() => setOpponent(value)}
                className="size-4 accent-[var(--color-red)]"
              />
              {label}
            </label>
          ))}
        </fieldset>
      </Box>
      <DeckChoice
        label={hotseat ? "Player 1's deck" : 'Your deck'}
        group="Your deck"
        decks={decks}
        value={mine}
        onChange={setMine}
      />
      {hotseat ? (
        <DeckChoice
          label="Player 2's deck"
          group="Opponent's deck"
          decks={allDecks}
          value={theirs}
          onChange={setTheirs}
        />
      ) : (
        <Box title="Opponent's deck">
          <p className="text-xl">Random: the bot plays a surprise starter, theme or meta deck.</p>
        </Box>
      )}
      <Button onClick={play} disabled={decks.length === 0} className="self-center px-10 py-4 text-sm">
        Play
      </Button>
    </ScreenFrame>
  );
}
