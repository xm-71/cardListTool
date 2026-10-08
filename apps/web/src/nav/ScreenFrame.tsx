import type { ReactNode } from 'react';
import { Header } from '../ui/retro/index.ts';
import { BackButton } from './BackButton.tsx';

/** Header, a Back button and the screen's content. */
export function ScreenFrame({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-full flex-col">
      <Header />
      <main className={`mx-auto flex w-full flex-col gap-5 p-4 ${wide ? 'max-w-6xl' : 'max-w-3xl'}`}>
        <div>
          <BackButton />
        </div>
        {children}
      </main>
    </div>
  );
}
