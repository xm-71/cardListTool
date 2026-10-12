import { useState } from 'react';
import { sfx } from '../../audio/sfx.ts';
import { registry } from '../../game/catalog.ts';
import { FIGHTS, keepableCards, payout, type FrontierRun } from '../../game/frontier/run.ts';
import { useProfile } from '../../profile/useProfile.ts';
import { Box, Button } from '../retro/index.ts';

/** The end of a run: what was won, one card to keep, and the claim. */
export function RunEnd({ run }: { run: FrontierRun }) {
  const end = useProfile((s) => s.endFrontierRun);
  const [keep, setKeep] = useState<string | null>(null);
  const cards = keepableCards(run);
  return (
    <Box title={run.cleared ? 'Run cleared!' : 'Run over'}>
      <div className="flex flex-col gap-3">
        <p className="text-xl">
          Fights won: {run.wins} of {FIGHTS}
        </p>
        <p className="font-pixel text-xs text-green-fg">+{payout(run)} credits</p>
        <fieldset>
          <legend className="mb-2 text-xl">Keep one card from your run deck:</legend>
          <div
            role="radiogroup"
            aria-label="Keep one card"
            className="flex max-h-72 flex-col gap-1 overflow-y-auto"
          >
            <label className="flex items-center gap-2 text-lg">
              <input
                type="radio"
                name="keep"
                aria-label="Keep nothing"
                checked={keep === null}
                onChange={() => setKeep(null)}
              />
              Keep nothing
            </label>
            {cards.map((id) => (
              <label key={id} className="flex items-center gap-2 text-lg">
                <input
                  type="radio"
                  name="keep"
                  aria-label={registry.defs[id]!.name}
                  checked={keep === id}
                  onChange={() => setKeep(id)}
                />
                {registry.defs[id]!.name}
              </label>
            ))}
          </div>
        </fieldset>
        <Button
          className="self-start"
          onClick={() => {
            sfx('confirm');
            void end(keep);
          }}
        >
          Claim rewards
        </Button>
      </div>
    </Box>
  );
}

/** Cleared runs, newest first. */
export function FrontierHall() {
  const hall = useProfile((s) => s.profile.frontier.hallOfFame);
  return (
    <Box title="Frontier Hall of Fame">
      {hall.length === 0 ? (
        <p className="text-xl">No one has conquered the Frontier yet.</p>
      ) : (
        <ol aria-label="Frontier Hall of Fame" className="flex flex-col gap-2">
          {hall.map((e, i) => (
            <li
              key={i}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b-2 border-ink/20 pb-2 text-xl"
            >
              {registry.defs[e.cover] && (
                <img src={`${registry.defs[e.cover]!.image}/low.webp`} alt="" className="w-10" />
              )}
              <span className="font-pixel text-[10px]">{e.playerName}</span>
              <span>{e.deckName}</span>
              <span className="opacity-70">{'♥'.repeat(e.livesLeft)}</span>
              <span className="ml-auto opacity-70">{e.date}</span>
            </li>
          ))}
        </ol>
      )}
    </Box>
  );
}
