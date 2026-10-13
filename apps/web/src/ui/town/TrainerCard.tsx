import { deckById, registry, type DeckId } from '../../game/catalog.ts';
import { resolveActiveDeck } from '../../game/deckCase.ts';
import { FIGHTS } from '../../game/frontier/run.ts';
import { LEADERS } from '../../game/gym.ts';
import { latestBinder, townStatus } from '../../game/town.ts';
import type { Route } from '../../nav/useNav.ts';
import { useProfile } from '../../profile/useProfile.ts';
import { BinderCover } from '../binder/BinderCover.tsx';
import { Sheet } from '../Sheet.tsx';

interface Props {
  onClose(): void;
  onGo(route: Route): void;
}

/** My House: the player's Trainer Card, in the style of the Game Boy games. */
export function TrainerCard({ onClose, onGo }: Props) {
  const profile = useProfile((s) => s.profile);
  const s = townStatus(profile);
  // The active deck: a premade deck, or the name and cover of a custom deck.
  const activeId = resolveActiveDeck(profile);
  const custom = activeId?.startsWith('custom:')
    ? profile.decks.find((d) => `custom:${d.id}` === activeId)
    : null;
  const premade =
    deckById((custom ? 'mega-gengar' : (activeId ?? 'mega-gengar')) as DeckId) ?? deckById('mega-gengar');
  const deck = custom
    ? {
        name: custom.name,
        cover: custom.cards.find((c) => registry.defs[c.id]?.category === 'Pokemon')?.id ?? premade.cover,
      }
    : premade;
  const collector = profile.collectorMode;
  const binder = collector ? latestBinder(profile) : null;
  return (
    <Sheet title="Trainer Card" onClose={onClose}>
      <div className="flex items-baseline justify-between gap-3 border-b-4 border-ink pb-2 font-pixel text-xs">
        <span>{profile.playerName ?? 'PLAYER'}</span>
        {!collector && <span className="text-[10px]">¢ {profile.credits.toLocaleString('en-US')}</span>}
      </div>
      <div className="flex gap-4">
        {binder ? (
          <div className="shrink-0 self-start">
            <BinderCover binder={binder} />
          </div>
        ) : (
          <img
            src={`${registry.defs[deck.cover]!.image}/low.webp`}
            alt=""
            className="retro-shadow aspect-[63/88] w-20 shrink-0 self-start rounded-md border-4 border-ink"
          />
        )}
        <dl className="flex min-w-0 flex-col gap-3 text-xl leading-tight">
          <div>
            <dt className="font-pixel text-[8px] uppercase">Deck</dt>
            <dd>{deck.name}</dd>
          </div>
          {!collector && (
            <>
              <div>
                <dt className="font-pixel text-[8px] uppercase">{`Badges ${s.badges} / ${LEADERS.length}`}</dt>
                <dd className="flex flex-wrap gap-1 pt-1" aria-hidden>
                  {LEADERS.map((l) => (
                    <span
                      key={l.id}
                      title={l.badge}
                      className={`h-4 w-4 border-2 border-ink ${profile.gym.badges.includes(l.id) ? 'bg-yellow' : ''}`}
                    />
                  ))}
                </dd>
              </div>
              <div>
                <dt className="font-pixel text-[8px] uppercase">Battle Frontier</dt>
                <dd>
                  {s.frontier
                    ? `Fight ${s.frontier.fight + 1} of ${FIGHTS} · ${s.frontier.lives} ${s.frontier.lives === 1 ? 'life' : 'lives'}`
                    : 'No run in progress'}
                </dd>
              </div>
            </>
          )}
          <div>
            <dt className="font-pixel text-[8px] uppercase">Collection</dt>
            <dd>{`${s.owned} different ${s.owned === 1 ? 'card' : 'cards'}`}</dd>
          </div>
        </dl>
      </div>
      <div className="flex flex-wrap gap-2">
        {!collector &&
          (
            [
              ['gym', 'Gym Challenge'],
              ['frontier', 'Battle Frontier'],
              ['decks', 'Decks'],
              ['deckcase', 'Deck Case'],
            ] as const
          ).map(([route, label]) => (
            <button
              key={route}
              type="button"
              onClick={() => onGo(route)}
              className="retro-shadow border-4 border-ink-fixed bg-yellow px-3 py-2 font-pixel text-[9px] uppercase text-ink-fixed"
            >
              {label}
            </button>
          ))}
      </div>
    </Sheet>
  );
}
