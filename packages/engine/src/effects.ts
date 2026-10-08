import type { Env } from './env.ts';
import { IllegalActionError } from './errors.ts';
import { defOf, other } from './state.ts';
import type { EffectSource, GameState, Origin, PlayerId, Prompt, PromptOption } from './types.ts';

/** Thrown inside an effect when it needs an answer that has not been given yet. */
class NeedInput {
  constructor(readonly prompt: Prompt) {}
}

/**
 * The only way effect code touches the game. Choices are answered from the recorded
 * answer list; when the answers run out the effect is suspended (see runEffect).
 */
export class EffectCtx {
  private cursor = 0;
  source: EffectSource | null = null;

  constructor(
    public state: GameState,
    readonly env: Env,
    /** The player whose action or card started this effect. */
    public me: PlayerId,
    private readonly answers: readonly string[],
  ) {}

  get opp(): PlayerId {
    return other(this.me);
  }

  def(uid: string) {
    return defOf(this.env, this.state, uid);
  }

  chooseCards(o: { player: PlayerId; from: string[]; min: number; max: number; message: string }): string[] {
    const options: PromptOption[] = o.from.map((uid) => ({ id: uid, label: this.def(uid).name, uid }));
    return this.choose('cards', o.player, options, o.min, o.max, o.message);
  }

  protected choose(
    kind: Prompt['kind'],
    player: PlayerId,
    options: PromptOption[],
    minIn: number,
    maxIn: number,
    message: string,
  ): string[] {
    const max = Math.min(maxIn, options.length);
    const min = Math.min(minIn, max);
    if (max === 0) return [];
    if (options.length === min && min === max) return options.map((o) => o.id);
    const selected: string[] = [];
    while (selected.length < max) {
      const available = options.filter((opt) => !selected.includes(opt.id));
      if (this.cursor >= this.answers.length) {
        throw new NeedInput({ player, kind, message, options: available, min, max, selected: [...selected] });
      }
      const answer = this.answers[this.cursor++]!;
      if (answer === 'done') {
        if (selected.length < min) throw new IllegalActionError(`Choose at least ${min}`);
        break;
      }
      if (!available.some((opt) => opt.id === answer))
        throw new IllegalActionError(`Not an option: ${answer}`);
      selected.push(answer);
    }
    return selected;
  }
}

export type EffectFn = (ctx: EffectCtx) => void;

/**
 * Run `fn` on a copy of `before`. If it completes, return the new state. If it needs
 * input, return `before` unchanged except for the prompt and a pending record from
 * which the effect is replayed (from `before`) once the answer arrives.
 */
export function runEffect(
  env: Env,
  before: GameState,
  origin: Origin,
  player: PlayerId,
  fn: EffectFn,
  answers: string[] = [],
): GameState {
  const work = structuredClone(before);
  work.prompt = null;
  work.pending = null;
  const ctx = new EffectCtx(work, env, player, answers);
  try {
    fn(ctx);
    return ctx.state;
  } catch (e) {
    if (!(e instanceof NeedInput)) throw e;
    const snapshot = structuredClone(before);
    snapshot.prompt = null;
    snapshot.pending = null;
    const paused = structuredClone(snapshot);
    paused.prompt = e.prompt;
    paused.pending = { snapshot, origin, player, answers: [...answers] };
    return paused;
  }
}
