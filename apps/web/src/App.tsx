export function App() {
  return (
    <main className="mx-auto flex min-h-full max-w-xl flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-4xl font-bold tracking-tight">Pokémon TCG</h1>
      <button
        type="button"
        className="rounded-lg bg-amber-400 px-6 py-3 font-semibold text-slate-900 hover:bg-amber-300"
      >
        Play
      </button>
    </main>
  );
}
