import { useEffect, useRef, useState } from 'react';

interface Props {
  text: string;
  onDone?: () => void;
  speedMs?: number;
  className?: string;
}

/** Typewriter dialogue: a click while typing shows everything; a click once complete calls onDone (once). */
export function DialogBox({ text, onDone, speedMs = 25, className = '' }: Props) {
  const [shown, setShown] = useState(0);
  const done = useRef(false);
  useEffect(() => {
    setShown(0);
    done.current = false;
    const t = setInterval(() => {
      setShown((n) => {
        if (n + 1 >= text.length) clearInterval(t);
        return Math.min(n + 1, text.length);
      });
    }, speedMs);
    return () => clearInterval(t);
  }, [text, speedMs]);
  const complete = shown >= text.length;
  const click = () => {
    if (!complete) setShown(text.length);
    else if (!done.current && onDone) {
      done.current = true;
      onDone();
    }
  };
  return (
    <button
      type="button"
      aria-label={text}
      onClick={click}
      className={`retro-box relative block w-full min-h-20 px-5 py-4 text-left text-2xl leading-snug ${className}`}
    >
      {text.slice(0, shown)}
      {complete && onDone && (
        <span aria-hidden className="animate-blink absolute right-4 bottom-2 font-pixel text-xs">
          ▼
        </span>
      )}
    </button>
  );
}
