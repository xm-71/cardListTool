import { useState } from 'react';
import { DECKS, registry, type DeckId } from '../game/catalog.ts';
import { useGame } from '../game/store.ts';

type Opponent = 'easy' | 'medium' | 'hotseat';

export function Home() {
  const start = useGame((s) => s.start);
  const [opponent, setOpponent] = useState<Opponent>('easy');
  const [mine, setMine] = useState<DeckId>('mega-gengar');
  const [theirs, setTheirs] = useState<DeckId>('mega-diancie');
  const hotseat = opponent === 'hotseat';
  const play = () =>
    start({
      mode: hotseat ? 'hotseat' : 'bot',
      difficulty: hotseat ? undefined : opponent,
      humanDeck: mine,
      botDeck: theirs,
      seed: (Date.now() ^ Math.floor(Math.random() * 2 ** 31)) >>> 0,
    });
  return (
    <main className="mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center gap-8 p-6 text-center">
      <h1 className="text-4xl font-bold tracking-tight">Pokémon TCG</h1>
      <fieldset className="flex flex-wrap justify-center gap-x-6 gap-y-2">
        <legend className="mb-2 w-full font-semibold text-white/70">Opponent</legend>
        {(
          [
            ['easy', 'Easy bot'],
            ['medium', 'Medium bot'],
            ['hotseat', 'Hotseat (2 players, 1 device)'],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className="flex items-center gap-2">
            <input
              type="radio"
              name="opponent"
              checked={opponent === value}
              onChange={() => setOpponent(value)}
            />{' '}
            {label}
          </label>
        ))}
      </fieldset>
      <DeckChoice
        label={hotseat ? "Player 1's deck" : 'Your deck'}
        group="Your deck"
        value={mine}
        onChange={setMine}
      />
      <DeckChoice
        label={hotseat ? "Player 2's deck" : "Opponent's deck"}
        group="Opponent's deck"
        value={theirs}
        onChange={setTheirs}
      />
      <button
        type="button"
        onClick={play}
        className="rounded-lg bg-amber-400 px-10 py-3 text-lg font-semibold text-slate-900 hover:bg-amber-300"
      >
        Play
      </button>
      <p className="max-w-md text-xs text-white/40">
        Private fan project for friends. Pokémon and all card names, text and images are © Nintendo,
        Creatures, GAME FREAK and The Pokémon Company. Not affiliated with or endorsed by them.
      </p>
    </main>
  );
}

function DeckChoice({
  label,
  group,
  value,
  onChange,
}: {
  label: string;
  group: string;
  value: DeckId;
  onChange(id: DeckId): void;
}) {
  return (
    <div role="group" aria-label={group} className="flex flex-col items-center gap-2">
      <span className="font-semibold text-white/70">{label}</span>
      <div className="flex flex-wrap justify-center gap-3">
        {DECKS.map((d) => (
          <button
            key={d.id}
            type="button"
            aria-pressed={value === d.id}
            onClick={() => onChange(d.id)}
            className={`flex w-32 flex-col items-center gap-2 rounded-xl p-2 ${value === d.id ? 'bg-amber-400/20 ring-2 ring-amber-400' : 'bg-white/5 hover:bg-white/10'}`}
          >
            <img src={`${registry.defs[d.cover]!.image}/low.webp`} alt="" className="w-24 rounded-lg" />
            <span className="text-sm font-semibold">{d.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
