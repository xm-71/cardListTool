import { useSettings } from '../settings/useSettings.ts';

export type Sfx =
  'cursor' | 'confirm' | 'back' | 'shake' | 'tear' | 'flip' | 'rare' | 'ultra' | 'special' | 'win' | 'lose';

/** [frequency Hz, start s, length s] — tiny chiptune phrases. */
type Note = [number, number, number];

const C5 = 523.25,
  E5 = 659.25,
  G5 = 783.99,
  C6 = 1046.5,
  E6 = 1318.5,
  G6 = 1568;

const PHRASES: Record<Exclude<Sfx, 'tear'>, { wave: OscillatorType; notes: Note[] }> = {
  cursor: { wave: 'square', notes: [[880, 0, 0.04]] },
  confirm: {
    wave: 'square',
    notes: [
      [660, 0, 0.05],
      [990, 0.05, 0.08],
    ],
  },
  back: {
    wave: 'square',
    notes: [
      [660, 0, 0.05],
      [440, 0.05, 0.08],
    ],
  },
  shake: {
    wave: 'triangle',
    notes: [
      [220, 0, 0.08],
      [262, 0.12, 0.08],
      [330, 0.24, 0.08],
      [392, 0.36, 0.12],
    ],
  },
  flip: {
    wave: 'square',
    notes: [
      [1200, 0, 0.03],
      [1600, 0.03, 0.04],
    ],
  },
  rare: {
    wave: 'square',
    notes: [
      [E5, 0, 0.08],
      [G5, 0.08, 0.16],
    ],
  },
  ultra: {
    wave: 'square',
    notes: [
      [C5, 0, 0.07],
      [E5, 0.07, 0.07],
      [G5, 0.14, 0.07],
      [C6, 0.21, 0.2],
    ],
  },
  special: {
    wave: 'square',
    notes: [
      [C5, 0, 0.1],
      [E5, 0.1, 0.1],
      [G5, 0.2, 0.1],
      [C6, 0.3, 0.12],
      [E6, 0.42, 0.12],
      [G6, 0.54, 0.35],
    ],
  },
  win: {
    wave: 'square',
    notes: [
      [G5, 0, 0.12],
      [G5, 0.14, 0.12],
      [G5, 0.28, 0.12],
      [C6, 0.42, 0.4],
    ],
  },
  lose: {
    wave: 'triangle',
    notes: [
      [392, 0, 0.18],
      [349, 0.2, 0.18],
      [330, 0.4, 0.18],
      [262, 0.6, 0.45],
    ],
  },
};

let ctx: AudioContext | null | undefined;

function context(): AudioContext | null {
  if (ctx !== undefined) return ctx;
  try {
    const Ctor = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext;
    ctx = Ctor ? new Ctor() : null;
  } catch {
    ctx = null;
  }
  return ctx;
}

function tone(c: AudioContext, wave: OscillatorType, [freq, start, len]: Note): void {
  const t = c.currentTime + start;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = wave;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0.08, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + len);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + len + 0.02);
}

function noise(c: AudioContext, len: number): void {
  const buffer = c.createBuffer(1, Math.floor(c.sampleRate * len), c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = c.createBufferSource();
  const gain = c.createGain();
  src.buffer = buffer;
  gain.gain.setValueAtTime(0.12, c.currentTime);
  src.connect(gain).connect(c.destination);
  src.start();
}

/** Plays a sound effect; silent when muted or when Web Audio is unavailable. Never throws. */
export function sfx(name: Sfx): void {
  if (!useSettings.getState().sound) return;
  const c = context();
  if (!c) return;
  try {
    if (name === 'tear') noise(c, 0.25);
    else for (const n of PHRASES[name].notes) tone(c, PHRASES[name].wave, n);
  } catch {
    // Audio is decoration; never let it break the game.
  }
}

/** Browsers only allow audio after a user gesture: call this from the first click or keypress. */
export function unlockAudio(): void {
  const c = context();
  if (c && c.state === 'suspended') void c.resume().catch(() => undefined);
}
