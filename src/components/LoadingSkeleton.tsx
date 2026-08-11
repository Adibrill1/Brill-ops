export function LoadingShell({
  label,
  children,
  className = 'space-y-8',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className} role="status" aria-live="polite" aria-label={label}>
      {children}
      <span className="sr-only">{label}…</span>
    </div>
  );
}

export function Skeleton({ className }: { className: string }) {
  return <div aria-hidden="true" className={`animate-pulse bg-slate-200 ${className}`} />;
}
