import { useProfile } from '../../profile/useProfile.ts';

/** Player name and credit balance. */
export function Header() {
  const name = useProfile((s) => s.profile.playerName);
  const credits = useProfile((s) => s.profile.credits);
  const ready = useProfile((s) => s.ready);
  return (
    <header className="flex items-center justify-between gap-4 border-b-4 border-ink bg-paper px-4 py-3 font-pixel text-[10px] uppercase">
      <span>{name ?? 'PLAYER'}</span>
      <span>{ready ? `¢ ${credits} credits` : 'Loading…'}</span>
    </header>
  );
}
