import { useState } from 'react';
import { DECKS, registry, type DeckId } from '../game/catalog.ts';
import { useGame } from '../game/store.ts';

export function Home() {
  const start = useGame((s) => s.start);
  const [mode, setMode] = useState<'bot' | 'hotseat'>('bot');
  const [deck, setDeck] = useState<DeckId>('mega-gengar');
  const other = DECKS.find((d) => d.id !== deck)!.id;
  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col items-center justify-center gap-8 p-6 text-center">
      <h1 className="text-4xl font-bold tracking-tight">Pokémon TCG</h1>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-semibold text-white/70">Opponent</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="mode" checked={mode === 'bot'} onChange={() => setMode('bot')} /> Easy bot
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="mode" checked={mode === 'hotseat'} onChange={() => setMode('hotseat')} />{' '}
          Hotseat (2 players, 1 device)
        </label>
      </fieldset>
      <fieldset>
        <legend className="mb-2 font-semibold text-white/70">
          {mode === 'bot' ? 'Your deck' : "Player 1's deck"}
        </legend>
        <div className="flex gap-4">
          {DECKS.map((d) => (
            <button
              key={d.id}
              type="button"
              aria-pressed={deck === d.id}
              onClick={() => setDeck(d.id)}
              className={`flex w-40 flex-col items-center gap-2 rounded-xl p-3 ${deck === d.id ? 'bg-amber-400/20 ring-2 ring-amber-400' : 'bg-white/5 hover:bg-white/10'}`}
            >
              <img src={`${registry.defs[d.cover]!.image}/low.webp`} alt="" className="w-28 rounded-lg" />
              <span className="font-semibold">{d.name}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <button
        type="button"
        onClick={() =>
          start({
            mode,
            humanDeck: deck,
            botDeck: other,
            seed: (Date.now() ^ Math.floor(Math.random() * 2 ** 31)) >>> 0,
          })
        }
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
