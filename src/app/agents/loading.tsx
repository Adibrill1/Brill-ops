import { LoadingShell, Skeleton } from '@/components/LoadingSkeleton';

export default function AgentsLoading() {
  return (
    <LoadingShell label="Loading agent directory" className="space-y-6">
      <header className="space-y-2">
        <Skeleton className="h-8 w-48 rounded" />
        <Skeleton className="h-4 w-56 rounded" />
      </header>

      <div className="space-y-3">
        <div className="flex gap-2">
          <Skeleton className="h-11 min-w-0 flex-1 rounded-lg" />
          <Skeleton className="h-11 w-20 rounded-lg" />
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 12 }, (_, index) => (
          <Skeleton key={index} className="h-16 rounded-xl" />
        ))}
      </div>
    </LoadingShell>
  );
}
