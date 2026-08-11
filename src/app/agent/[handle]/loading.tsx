import { LoadingShell, Skeleton } from '@/components/LoadingSkeleton';

export default function AgentLoading() {
  return (
    <LoadingShell label="Loading agent profile">
      <div className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-6">
        <Skeleton className="h-16 w-16 shrink-0 rounded-full" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-7 w-40 rounded" />
          <Skeleton className="h-5 w-56 max-w-full rounded" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      </div>

      <div className="space-y-3">
        <Skeleton className="h-6 w-24 rounded" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Skeleton className="h-6 w-52 rounded" />
        <Skeleton className="h-28 rounded-xl" />
      </div>
    </LoadingShell>
  );
}
