export function MbLoading({ label = "Loading…" }: { label?: string }): JSX.Element {
  return <p className="text-sm text-slate-500">{label}</p>;
}

export function MbError({ message }: { message: string }): JSX.Element {
  return (
    <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
      {message}
    </p>
  );
}
