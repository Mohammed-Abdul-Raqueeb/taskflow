import { Skeleton } from '@/components/ui/states'

export default function SettingsLoading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading settings">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Skeleton className="h-80 w-full rounded-[calc(var(--radius-app)+2px)]" />
          <Skeleton className="h-64 w-full rounded-[calc(var(--radius-app)+2px)]" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-56 w-full rounded-[calc(var(--radius-app)+2px)]" />
          <Skeleton className="h-56 w-full rounded-[calc(var(--radius-app)+2px)]" />
        </div>
      </div>
    </div>
  )
}
