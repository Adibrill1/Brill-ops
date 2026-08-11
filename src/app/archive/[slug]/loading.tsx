import { LoadingShell, Skeleton } from '@/components/LoadingSkeleton';

export default function ArchiveCampaignLoading() {
  return (
    <LoadingShell label="Loading archived campaign" className="space-y-10">
      <Skeleton className="h-44 rounded-2xl bg-slate-300" />

      <div className="space-y-3">
        <Skeleton className="h-6 w-32 rounded" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Skeleton className="h-6 w-28 rounded" />
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Skeleton className="h-6 w-40 rounded" />
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-12 rounded-lg" />
        ))}
      </div>
    </LoadingShell>
  );
}
