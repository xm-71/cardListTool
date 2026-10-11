import type { PlayerId } from '@ptcg/engine';
import { registry } from '../catalog.ts';
import { useGame } from '../store.ts';
import type { Beat } from './beats.ts';

/**
 * Battle animations, played with the Web Animations API on the board's own elements and on "ghost" copies in a
 * fixed layer above it. The board marks what can be animated with data attributes:
 * `data-slot-id` (a Pokémon in play, by the first card of its stack), `data-hand-card`, `data-hand-of`,
 * `data-deck-of`, `data-prizes-of`, `data-bench-space-of` and `data-active-of`.
 */

const live: Animation[] = [];
const ghosts = new Set<HTMLElement>();

export const canAnimate = (): boolean =>
  typeof document !== 'undefined' &&
  typeof Element !== 'undefined' &&
  typeof Element.prototype.animate === 'function';

/** Stop everything and put the board back as it is drawn (called when the new state is shown). */
export function stopAll(): void {
  for (const a of live.splice(0)) a.cancel();
  for (const g of ghosts) g.remove();
  ghosts.clear();
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function play(el: Element, frames: Keyframe[], ms: number, easing = 'ease-out'): Promise<void> {
  const a = el.animate(frames, { duration: Math.max(1, ms), easing, fill: 'forwards' });
  live.push(a);
  return a.finished.then(
    () => undefined,
    () => undefined,
  );
}

/** The first element matching `selector` that is actually on screen. */
function find(selector: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(selector)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}
const slotEl = (base: string) => find(`[data-slot-id="${base}"]`);
const cardEl = (slot: HTMLElement | null) =>
  (slot?.querySelector('[data-uid]') as HTMLElement | null) ?? slot;
const handOf = (p: PlayerId) => find(`[data-hand-of="${p}"]`);

function layer(): HTMLElement {
  let el = document.getElementById('fx-layer');
  if (!el) {
    el = document.createElement('div');
    el.id = 'fx-layer';
    el.setAttribute('aria-hidden', 'true');
    el.className = 'pointer-events-none fixed inset-0 z-[60] overflow-hidden';
    document.body.appendChild(el);
  }
  return el;
}

function ghost(className: string, style: Partial<CSSStyleDeclaration> = {}): HTMLElement {
  const g = document.createElement('div');
  g.className = `absolute left-0 top-0 ${className}`;
  Object.assign(g.style, style);
  layer().appendChild(g);
  ghosts.add(g);
  return g;
}

const imageOf = (uid: string): string | null => {
  const card = useGame.getState().state?.cards[uid];
  const def = card && registry.defs[card.defId];
  return def ? `${def.image}/low.webp` : null;
};

function cardGhost(uid: string | null, from: DOMRect): HTMLElement {
  const src = uid ? imageOf(uid) : null;
  return ghost(
    src
      ? 'rounded-[6%] border-2 border-ink-fixed bg-paper-fixed bg-cover bg-center'
      : 'card-back rounded-[6%] border-2 border-ink-fixed',
    {
      width: `${from.width}px`,
      height: `${from.height}px`,
      ...(src ? { backgroundImage: `url(${src})` } : {}),
    },
  );
}

/** A card flying in an arc from one box to another. */
async function fly(uid: string | null, from: DOMRect, to: DOMRect, ms: number): Promise<void> {
  const g = cardGhost(uid, from);
  const sx = to.width / from.width;
  const sy = to.height / from.height;
  const mid = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 40 };
  await play(
    g,
    [
      { transform: `translate(${from.x}px, ${from.y}px) scale(1)` },
      {
        transform: `translate(${mid.x}px, ${mid.y}px) scale(${((1 + sx) / 2) * 1.12}, ${((1 + sy) / 2) * 1.12})`,
        offset: 0.5,
      },
      {
        transform: `translate(${to.x + (to.width - from.width) / 2}px, ${to.y + (to.height - from.height) / 2}px) scale(${sx}, ${sy})`,
      },
    ],
    ms,
    'ease-in-out',
  );
  g.remove();
  ghosts.delete(g);
}

/** A ring or burst at the middle of a box. */
function burst(at: DOMRect, ms: number, colour = 'var(--color-yellow)'): Promise<void> {
  const size = Math.max(at.width, 60);
  const g = ghost('rounded-full', {
    width: `${size}px`,
    height: `${size}px`,
    background: `radial-gradient(circle, #fff 0 22%, ${colour} 23% 42%, transparent 43%)`,
  });
  const x = at.x + at.width / 2 - size / 2;
  const y = at.y + at.height / 2 - size / 2;
  return play(
    g,
    [
      { transform: `translate(${x}px, ${y}px) scale(0.2)`, opacity: 1 },
      { transform: `translate(${x}px, ${y}px) scale(1.5)`, opacity: 0 },
    ],
    ms,
  );
}

/** Text (a damage number, "Poisoned") rising from a box. */
function floatText(text: string, at: DOMRect, ms: number, colour = '#fff'): Promise<void> {
  const g = ghost('font-pixel text-center whitespace-nowrap', {
    width: '120px',
    fontSize: text.length > 4 ? '12px' : '22px',
    color: colour,
    webkitTextStroke: '2px var(--color-ink-fixed)',
    paintOrder: 'stroke fill',
    textShadow: '3px 3px 0 var(--color-ink-fixed)',
  });
  const x = at.x + at.width / 2 - 60;
  const y = at.y + at.height / 3;
  return play(
    g,
    [
      { transform: `translate(${x}px, ${y + 10}px) scale(0.4)`, opacity: 0 },
      { transform: `translate(${x}px, ${y - 10}px) scale(1.25)`, opacity: 1, offset: 0.25 },
      { transform: `translate(${x}px, ${y - 50}px) scale(1)`, opacity: 0 },
    ],
    ms,
  );
}

function shake(el: HTMLElement, ms: number): Promise<void> {
  return play(
    el,
    [
      { transform: 'translateX(0)' },
      { transform: 'translateX(-9px) rotate(-3deg)' },
      { transform: 'translateX(8px) rotate(2deg)' },
      { transform: 'translateX(-5px)' },
      { transform: 'translateX(0)' },
    ],
    ms,
  );
}

function flash(at: DOMRect, ms: number): Promise<void> {
  const g = ghost('rounded-[6%] bg-white', {
    width: `${at.width}px`,
    height: `${at.height}px`,
    transform: `translate(${at.x}px, ${at.y}px)`,
  });
  return play(
    g,
    [{ opacity: 0 }, { opacity: 0.95 }, { opacity: 0.3 }, { opacity: 0.95 }, { opacity: 0 }],
    ms,
  );
}

/** Drain a Pokémon's HP bar by `amount`. */
function drain(slot: HTMLElement, amount: number, ms: number): Promise<void> {
  const meter = slot.querySelector<HTMLElement>('[role="meter"]');
  const fill = meter?.firstElementChild as HTMLElement | null;
  if (!meter || !fill) return Promise.resolve();
  const max = Number(meter.getAttribute('aria-valuemax')) || 1;
  const now = Number(meter.getAttribute('aria-valuenow')) || 0;
  const to = Math.max(0, now - amount);
  return play(
    fill,
    [{ width: `${(now / max) * 100}%` }, { width: `${(to / max) * 100}%` }],
    ms,
    'ease-in-out',
  );
}

function bubbles(at: DOMRect, colour: string, ms: number): Promise<void> {
  const jobs: Promise<void>[] = [];
  for (let k = 0; k < 8; k++) {
    const g = ghost('rounded-full border border-white', {
      width: '10px',
      height: '10px',
      background: colour,
    });
    const x = at.x + 8 + Math.random() * Math.max(0, at.width - 16);
    const y = at.y + at.height - 10;
    jobs.push(
      play(
        g,
        [
          { transform: `translate(${x}px, ${y}px) scale(0.5)`, opacity: 1 },
          { transform: `translate(${x}px, ${y - at.height * 0.8}px) scale(1.2)`, opacity: 0 },
        ],
        ms * (0.7 + k * 0.04),
      ),
    );
  }
  return Promise.all(jobs).then(() => undefined);
}

function banner(text: string, mine: boolean, ms: number): Promise<void> {
  const g = ghost(
    `inset-x-0 flex h-16 items-center justify-center border-y-4 border-ink-fixed font-pixel text-base uppercase ${mine ? 'bg-yellow text-ink-fixed' : 'bg-purple text-paper-fixed'}`,
    { top: '42%', right: '0' },
  );
  g.textContent = text;
  return play(
    g,
    [
      { transform: 'translateX(-100%)' },
      { transform: 'translateX(0)', offset: 0.25 },
      { transform: 'translateX(0)', offset: 0.75 },
      { transform: 'translateX(100%)' },
    ],
    ms,
    'ease-in-out',
  );
}

async function coin(heads: boolean, ms: number): Promise<void> {
  const g = ghost(
    'flex h-16 w-16 items-center justify-center rounded-full border-4 border-ink-fixed font-pixel text-lg text-ink-fixed',
    {
      background: 'radial-gradient(circle at 35% 35%, #ffe680, var(--color-yellow) 60%, #b88a10)',
      left: 'calc(50% - 32px)',
      top: '45%',
    },
  );
  await play(
    g,
    [
      { transform: 'translateY(0) rotateY(0)' },
      { transform: 'translateY(-120px) rotateY(900deg)', offset: 0.5 },
      { transform: 'translateY(0) rotateY(1800deg)' },
    ],
    ms * 0.65,
    'ease-in-out',
  );
  g.textContent = heads ? 'H' : 'T';
  await play(
    g,
    [{ transform: 'scale(1)' }, { transform: 'scale(1.3)' }, { transform: 'scale(1)' }],
    ms * 0.2,
  );
  await sleep(ms * 0.15);
}

const CONDITION_COLOUR = {
  poisoned: 'var(--color-purple)',
  burned: 'var(--color-red)',
  asleep: 'var(--color-blue)',
  paralyzed: 'var(--color-yellow)',
  confused: 'var(--color-green)',
} as const;

const rectOf = (el: HTMLElement) => el.getBoundingClientRect();

/** Move a board element onto another element's box and keep it there until the new state is shown. */
function slide(el: HTMLElement, to: DOMRect, ms: number): Promise<void> {
  const from = rectOf(el);
  const dx = to.x + to.width / 2 - (from.x + from.width / 2);
  const dy = to.y + to.height / 2 - (from.y + from.height / 2);
  return play(
    el,
    [
      { transform: 'translate(0, 0)', zIndex: 40 },
      { transform: `translate(${dx}px, ${dy}px)`, zIndex: 40 },
    ],
    ms,
    'ease-in-out',
  );
}

/** Play one beat on the board. Beats whose elements are not on screen finish at once. */
export async function domRunner(beat: Beat, ms: number, viewer: PlayerId): Promise<void> {
  switch (beat.kind) {
    case 'note':
      return;
    case 'turn':
      return banner(beat.player === viewer ? 'Your turn' : "Opponent's turn", beat.player === viewer, ms);
    case 'draw': {
      const deck = find(`[data-deck-of="${beat.player}"]`);
      const hand = handOf(beat.player);
      if (!deck || !hand) return;
      const to = rectOf(hand);
      return fly(null, rectOf(deck), new DOMRect(to.x + to.width / 2 - 20, to.y, 40, 56), ms);
    }
    case 'bench': {
      const src =
        find(`[data-hand-card="${beat.uid}"]`) ??
        handOf(beat.player) ??
        find(`[data-deck-of="${beat.player}"]`);
      const to = find(`[data-bench-space-of="${beat.player}"]`);
      if (!src || !to) return;
      if (src.dataset.handCard) void play(src, [{ opacity: 0 }, { opacity: 0 }], ms);
      return fly(beat.uid, rectOf(src), rectOf(to), ms);
    }
    case 'trainer': {
      const src = find(`[data-hand-card="${beat.uid}"]`) ?? handOf(beat.player);
      if (!src) return;
      if (src.dataset.handCard) void play(src, [{ opacity: 0 }, { opacity: 0 }], ms);
      const w = Math.min(window.innerWidth * 0.4, 220);
      const centre = new DOMRect(window.innerWidth / 2 - w / 2, window.innerHeight / 2 - w * 0.7, w, w * 1.4);
      const from = rectOf(src);
      const g = cardGhost(beat.uid, centre);
      await play(
        g,
        [
          { transform: `translate(${from.x}px, ${from.y}px) scale(${from.width / w})`, opacity: 1 },
          { transform: `translate(${centre.x}px, ${centre.y}px) scale(1)`, opacity: 1, offset: 0.35 },
          { transform: `translate(${centre.x}px, ${centre.y}px) scale(1)`, opacity: 1, offset: 0.8 },
          { transform: `translate(${centre.x}px, ${centre.y - 20}px) scale(0.9)`, opacity: 0 },
        ],
        ms,
      );
      return;
    }
    case 'energy': {
      const slot = slotEl(beat.target);
      if (!slot) return;
      const owner = useGame.getState().state?.cards[beat.uid]?.owner ?? viewer;
      const src = find(`[data-hand-card="${beat.uid}"]`) ?? find(`[data-deck-of="${owner}"]`);
      const card = rectOf(cardEl(slot)!);
      if (src) {
        if (src.dataset.handCard) void play(src, [{ opacity: 0 }, { opacity: 0 }], ms);
        await fly(
          beat.uid,
          rectOf(src),
          new DOMRect(card.x + card.width / 4, card.y + card.height / 2, card.width / 2, card.height / 2),
          ms * 0.6,
        );
      }
      await burst(card, ms * 0.4, '#8a90a0');
      return;
    }
    case 'evolve': {
      const slot = slotEl(beat.target);
      if (!slot) return;
      const card = cardEl(slot)!;
      const src = find(`[data-hand-card="${beat.uid}"]`);
      if (src) {
        void play(src, [{ opacity: 0 }, { opacity: 0 }], ms);
        await fly(beat.uid, rectOf(src), rectOf(card), ms * 0.4);
      }
      await Promise.all([
        flash(rectOf(card), ms * 0.45),
        play(
          card,
          [
            { transform: 'scale(1)' },
            { transform: 'scale(1.15)' },
            { transform: 'scale(0.95)' },
            { transform: 'scale(1)' },
          ],
          ms * 0.6,
        ),
      ]);
      return;
    }
    case 'attack': {
      const attacker = cardEl(slotEl(beat.by));
      const target = beat.target ? cardEl(slotEl(beat.target)) : null;
      if (!attacker) return;
      const a = rectOf(attacker);
      const t = target ? rectOf(target) : a;
      const dx = (t.x + t.width / 2 - (a.x + a.width / 2)) * 0.5;
      const dy = (t.y + t.height / 2 - (a.y + a.height / 2)) * 0.5;
      await play(
        attacker,
        [
          { transform: 'translate(0, 0) scale(1)', zIndex: 40 },
          { transform: `translate(${-dx * 0.1}px, ${-dy * 0.1}px) scale(1.05)`, zIndex: 40, offset: 0.35 },
          { transform: `translate(${dx}px, ${dy}px) scale(1.08)`, zIndex: 40, offset: 0.7 },
          { transform: 'translate(0, 0) scale(1)', zIndex: 40 },
        ],
        ms,
        'ease-in',
      );
      return;
    }
    case 'damage': {
      const slot = slotEl(beat.target);
      const card = cardEl(slot);
      if (!slot || !card) return;
      const r = rectOf(card);
      void burst(r, ms * 0.45);
      void shake(card, ms * 0.4);
      void floatText(beat.amount > 0 ? `-${beat.amount}` : '0', r, ms);
      await drain(slot, beat.amount, ms * 0.7);
      await sleep(ms * 0.3);
      return;
    }
    case 'knockout': {
      const card = cardEl(slotEl(beat.target));
      if (!card) return;
      await flash(rectOf(card), ms * 0.4);
      await play(
        card,
        [
          { transform: 'translateY(0) rotate(0)', opacity: 1, filter: 'grayscale(0)' },
          { transform: 'translateY(60px) rotate(8deg) scale(0.7)', opacity: 0, filter: 'grayscale(1)' },
        ],
        ms * 0.6,
        'ease-in',
      );
      return;
    }
    case 'prize': {
      const prizes = find(`[data-prizes-of="${beat.player}"]`);
      const hand = handOf(beat.player);
      if (!prizes || !hand) return;
      const to = rectOf(hand);
      return fly(null, rectOf(prizes), new DOMRect(to.x + to.width / 2 - 20, to.y, 40, 56), ms);
    }
    case 'promote': {
      const slot = slotEl(beat.target);
      const spot = find(`[data-active-of="${beat.player}"]`);
      if (!slot || !spot) return;
      return slide(slot, rectOf(spot), ms);
    }
    case 'retreat': {
      const out = slotEl(beat.from);
      const inn = slotEl(beat.to);
      if (!out || !inn) return;
      const a = rectOf(out);
      const b = rectOf(inn);
      await Promise.all([slide(out, b, ms), slide(inn, a, ms)]);
      return;
    }
    case 'coin':
      return coin(beat.heads, ms);
    case 'condition':
    case 'checkup': {
      const slot = slotEl(beat.target);
      const card = cardEl(slot);
      if (!slot || !card) return;
      const r = rectOf(card);
      const label = beat.kind === 'condition' ? beat.condition : null;
      void bubbles(r, CONDITION_COLOUR[beat.condition], ms);
      if (label) void floatText(label.toUpperCase(), r, ms);
      if (beat.kind === 'checkup' && beat.amount) {
        void floatText(`-${beat.amount}`, r, ms);
        await drain(slot, beat.amount, ms * 0.7);
        await sleep(ms * 0.3);
        return;
      }
      await sleep(ms);
      return;
    }
  }
}
