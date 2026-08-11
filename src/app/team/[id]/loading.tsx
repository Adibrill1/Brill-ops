import { LoadingShell, Skeleton } from '@/components/LoadingSkeleton';

export default function TeamLoading() {
  return (
    <LoadingShell label="Loading team">
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6">
        <Skeleton className="h-8 w-52 max-w-full rounded" />
        <Skeleton className="h-5 w-64 max-w-full rounded" />
        <Skeleton className="h-12 rounded-lg" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24 rounded-xl" />
        ))}
      </div>

      <div className="space-y-3">
        <Skeleton className="h-6 w-44 rounded" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-11 w-28 rounded-full" />
          ))}
        </div>
      </div>
    </LoadingShell>
  );
}
