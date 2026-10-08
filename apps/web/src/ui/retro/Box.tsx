import type { ReactNode } from 'react';

/** A paper panel with a double ink border. */
export function Box({
  title,
  className = '',
  children,
}: {
  title?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`retro-box p-4 ${className}`}>
      {title && <h2 className="mb-3 font-pixel text-xs uppercase">{title}</h2>}
      {children}
    </div>
  );
}
