import { Component, type ReactNode } from 'react';
import { useGame } from '../game/store.ts';

export function downloadBugReport(error: string): void {
  const { config, actions } = useGame.getState();
  const blob = new Blob([JSON.stringify({ config, actions, error }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ptcg-bug-${config?.seed ?? 'unknown'}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function ErrorScreen({ error, onHome }: { error: string; onHome(): void }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <h2 className="text-2xl font-bold">Something went wrong</h2>
      <p className="max-w-lg font-mono text-sm text-white/60">{error}</p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => downloadBugReport(error)}
          className="rounded-lg bg-amber-400 px-5 py-2 font-semibold text-slate-900"
        >
          Download bug report
        </button>
        <button type="button" onClick={onHome} className="rounded-lg bg-white/10 px-5 py-2 hover:bg-white/20">
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
