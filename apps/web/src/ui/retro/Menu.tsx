import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { sfx } from '../../audio/sfx.ts';

export interface MenuItem {
  id: string;
  label: string;
  disabled?: boolean;
}

interface Props {
  label: string;
  items: MenuItem[];
  onSelect(id: string): void;
  initial?: string;
  className?: string;
  /** Take keyboard focus on mount, so arrows and Enter work straight away. */
  autoFocus?: boolean;
}

/** A ▶ cursor menu: arrow keys move, Enter/Space select, the mouse hovers and clicks. */
export function Menu({ label, items, onSelect, initial, className = '', autoFocus = false }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);
  const enabled = items.filter((i) => !i.disabled);
  const [active, setActive] = useState(initial ?? enabled[0]?.id);
  const move = (delta: number) => {
    if (enabled.length === 0) return;
    const at = enabled.findIndex((i) => i.id === active);
    setActive(enabled[(at + delta + enabled.length) % enabled.length]!.id);
    sfx('cursor');
  };
  const choose = (id: string) => {
    sfx('confirm');
    onSelect(id);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') move(1);
    else if (e.key === 'ArrowUp') move(-1);
    else if ((e.key === 'Enter' || e.key === ' ') && active) choose(active);
    else return;
    e.preventDefault();
  };
  return (
    <div
      ref={ref}
      role="menu"
      aria-label={label}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className={`flex flex-col outline-none ${className}`}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          tabIndex={-1}
          disabled={item.disabled}
          data-active={item.id === active}
          onMouseEnter={() => !item.disabled && setActive(item.id)}
          onClick={() => choose(item.id)}
          className="relative py-2 pl-7 text-left font-pixel text-xs uppercase disabled:opacity-40"
        >
          {item.id === active && (
            <span aria-hidden className="absolute left-0">
              ▶
            </span>
          )}
          {item.label}
        </button>
      ))}
    </div>
  );
}
