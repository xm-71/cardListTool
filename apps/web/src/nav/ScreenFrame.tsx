import type { ReactNode } from 'react';
import { Header } from '../ui/retro/index.ts';
import { BackButton } from './BackButton.tsx';

/** Header, a Back button (with optional `actions` beside it) and the screen's content. */
export function ScreenFrame({
  children,
  wide = false,
  actions,
}: {
  children: ReactNode;
  wide?: boolean;
  actions?: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <Header />
      <main className={`mx-auto flex w-full flex-col gap-5 p-4 ${wide ? 'max-w-6xl' : 'max-w-3xl'}`}>
        <div className="flex flex-wrap items-center gap-3">
          <BackButton />
          {actions}
        </div>
        {children}
      </main>
    </div>
  );
}
