import { useState } from 'react';
import { sfx } from '../../audio/sfx.ts';
import { registry } from '../../game/catalog.ts';
import type { FrontierRun } from '../../game/frontier/run.ts';
import { useProfile } from '../../profile/useProfile.ts';
import { CardThumb } from '../CardThumb.tsx';
import { Box, Button } from '../retro/index.ts';
import { CutPicker } from './CutPicker.tsx';

const KIND = { line: 'Pokémon', trainers: 'Trainers', energy: 'Special Energy' } as const;

/** The 3 offers after a win, then the cut picker for the one taken. */
export function RewardPanel({ run }: { run: FrontierRun }) {
  const take = useProfile((s) => s.takeFrontierOffer);
  const skip = useProfile((s) => s.skipFrontierOffer);
  const [picking, setPicking] = useState<number | null>(null);
  const offers = run.offers ?? [];

  if (picking !== null) {
    const offer = offers[picking]!;
    const add = offer.kind === 'package' ? offer.pkg.cards : [];
    return (
      <CutPicker
        deck={run.deck}
        add={add}
        count={offer.kind === 'package' ? add.reduce((n, c) => n + c.count, 0) : 3}
        tuneup={offer.kind === 'tuneup'}
        onCancel={() => setPicking(null)}
        onConfirm={(cut, energyTypes) => {
          sfx('confirm');
          void take(picking, cut, energyTypes).then(() => setPicking(null));
        }}
      />
    );
  }
  return (
    <Box title={`Fight ${run.fight + 1} won! Choose a reward`}>
      <ol aria-label="Offers" className="grid gap-4 sm:grid-cols-3">
        {offers.map((o, i) => (
          <li key={i} className="retro-box flex flex-col gap-3 p-3">
            <h3 className="font-pixel text-[10px]">
              {o.kind === 'tuneup'
                ? 'Tune-up'
                : `${KIND[o.pkg.kind]}${o.pkg.tier === 'plain' ? '' : ` · ${o.pkg.tier === 'ace' ? 'ACE SPEC' : 'ex'}`}`}
            </h3>
            {o.kind === 'tuneup' ? (
              <p className="text-lg">Swap up to 3 cards for basic Energy of your choice.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {o.pkg.cards.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 text-lg">
                    <CardThumb def={registry.defs[c.id]!} />
                    <span>{registry.defs[c.id]!.name}</span>
                    <span>×{c.count}</span>
                  </li>
                ))}
              </ul>
            )}
            <Button className="mt-auto" aria-label={`Take offer ${i + 1}`} onClick={() => setPicking(i)}>
              Take
            </Button>
          </li>
        ))}
      </ol>
      <Button variant="plain" className="mt-4" onClick={() => void skip()}>
        Skip
      </Button>
    </Box>
  );
}
