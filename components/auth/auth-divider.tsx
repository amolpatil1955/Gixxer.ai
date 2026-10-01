export function AuthDivider({ label = "or" }: { label?: string }) {
  return (
    <div className="flex items-center gap-4" role="separator" aria-label={label}>
      <span className="h-px flex-1 bg-line-strong" />
      <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink-500">{label}</span>
      <span className="h-px flex-1 bg-line-strong" />
    </div>
  );
}
