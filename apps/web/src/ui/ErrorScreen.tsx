import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useGame } from '../game/store.ts';

/** Everything needed to replay and locate a crash: the game, its moves, what failed, and where. */
export function bugReport(error?: string) {
  const { config, actions, failure } = useGame.getState();
  return {
    config,
    actions,
    error: error ?? useGame.getState().error,
    failed: failure,
    device: {
      userAgent: navigator.userAgent,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
    },
    build: typeof __BUILD__ === 'string' ? __BUILD__ : 'dev',
  };
}

export function downloadBugReport(error: string): void {
  const { config } = useGame.getState();
  const blob = new Blob([JSON.stringify(bugReport(error), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ptcg-bug-${config?.seed ?? 'unknown'}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function ErrorScreen({ error, onHome }: { error: string; onHome(): void }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <h2 className="font-pixel text-base uppercase text-red-fg">Something went wrong</h2>
      <p className="retro-box max-w-lg p-4 text-xl">{error}</p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => downloadBugReport(error)}
          className="retro-shadow border-4 border-ink bg-yellow px-4 py-2 font-pixel text-[10px] uppercase text-ink-fixed hover:brightness-105"
        >
          Download bug report
        </button>
        <button
          type="button"
          onClick={onHome}
          className="border-4 border-ink bg-paper px-3 py-2 font-pixel text-[10px] uppercase text-ink hover:bg-cream"
        >
          Home
        </button>
      </div>
    </div>
  );
}

/** Catches rendering errors so a bad card effect never white-screens the app. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: unknown) {
    return { error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) };
  }
  componentDidCatch(e: unknown, info: ErrorInfo) {
    const stack = `${e instanceof Error ? (e.stack ?? '') : ''}\n--- components ---${info.componentStack ?? ''}`;
    useGame.setState({
      error: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
      failure: { source: 'render', stack },
    });
  }
  render() {
    if (this.state.error) {
      return (
        <ErrorScreen
          error={this.state.error}
          onHome={() => {
            useGame.getState().reset();
            this.setState({ error: null });
          }}
        />
      );
    }
    return this.props.children;
  }
}
