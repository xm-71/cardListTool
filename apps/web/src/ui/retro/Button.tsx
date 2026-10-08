import type { ButtonHTMLAttributes } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'plain' };

/** A chunky pixel button. */
export function Button({ variant = 'primary', className = '', type = 'button', ...rest }: Props) {
  const colours = variant === 'primary' ? 'bg-yellow hover:brightness-105' : 'bg-paper hover:bg-cream';
  return (
    <button
      type={type}
      className={`retro-shadow border-4 border-ink px-3 py-2 font-pixel text-[10px] uppercase text-ink active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-40 ${colours} ${className}`}
      {...rest}
    />
  );
}
