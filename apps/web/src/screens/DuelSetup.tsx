import { useMemo, useState } from 'react';
import { validateCustomDeck } from '@ptcg/economy';
import { sfx } from '../audio/sfx.ts';
import { deckSources, registry } from '../game/catalog.ts';
import { playableIn, resolveActiveDeck } from '../game/deckCase.ts';
import { useGame } from '../game/store.ts';
import { ScreenFrame } from '../nav/ScreenFrame.tsx';
import { useNav } from '../nav/useNav.ts';
import { useProfile } from '../profile/useProfile.ts';
import { ActiveDeckPanel } from '../ui/ActiveDeckPanel.tsx';
import { DeckChoice } from '../ui/DeckChoice.tsx';
import { Box, Button } from '../ui/retro/index.ts';

type Opponent = 'easy' | 'medium' | 'hard' | 'hotseat';

const OPPONENTS = [
  ['easy', 'Easy bot'],
  ['medium', 'Medium bot'],
  ['hard', 'Hard bot'],
  ['hotseat', 'Hotseat (2 players, 1 device)'],
] as const;

/** The choices the player had made when they opened the Deck Case, so coming back restores them. */
let resume: { opponent: Opponent; theirs: string } | null = null;

/** Choose the opponent and both decks, then start a game. */
export function DuelSetup() {
  const start = useGame((s) => s.start);
  const [restored] = useState(() => {
    const r = resume;
    resume = null;
    return r;
  });
  const [opponent, setOpponent] = useState<Opponent>(restored?.opponent ?? 'easy');
  const customDecks = useProfile((s) => s.profile.decks);
  const collection = useProfile((s) => s.profile.collection);
  const profile = useProfile((s) => s.profile);
  // Custom decks that no longer validate (e.g. a card's playable status changed) are left out of the opponent list.
  const validCustom = useMemo(
    () =>
      customDecks.filter(
        (d) => validateCustomDeck({ name: d.name, cards: d.cards }, registry, collection).length === 0,
      ),
    [customDecks, collection],
  );
  // A hotseat friend can take any premade deck.
  const allDecks = useMemo(() => deckSources(validCustom), [validCustom]);
  // The active deck can be a custom deck that only works in Gym Challenge; Duel then asks for another.
  const activeId = resolveActiveDeck(profile);
  const mine = deckSources(customDecks).find((d) => d.id === activeId);
  const gymOnly =
    mine?.kind === 'custom' &&
    !playableIn(
      customDecks.find((d) => `custom:${d.id}` === mine.id)!,
      collection,
    ).standard;
  const [theirs, setTheirs] = useState(restored?.theirs ?? 'mega-diancie');
  const hotseat = opponent === 'hotseat';
  const listOf = (id: string) => (allDecks.find((d) => d.id === id) ?? allDecks[0]!).list;
  // Bots play a random starter, theme or meta deck: every premade deck, owned by the player or not.
  const botPool = allDecks.filter((d) => d.kind !== 'custom');
  const play = () => {
    sfx('confirm');
    start({
      mode: hotseat ? 'hotseat' : 'bot',
      difficulty: hotseat ? undefined : opponent,
      humanDeck: mine!.list,
      botDeck: hotseat ? listOf(theirs) : botPool[Math.floor(Math.random() * botPool.length)]!.list,
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
      <ActiveDeckPanel
        title={hotseat ? "Player 1's deck" : 'Your deck'}
        source={mine}
        notice={gymOnly ? 'This deck can only be used in Gym Challenge' : undefined}
        onChange={() => {
          resume = { opponent, theirs };
          useNav.getState().go('deckcase', 'duel');
        }}
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
      <Button onClick={play} disabled={!mine || gymOnly} className="self-center px-10 py-4 text-sm">
        Play
      </Button>
    </ScreenFrame>
  );
}
