import { Skeleton } from '@/components/ui/states'

export default function ProjectsLoading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading projects">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-36 w-full rounded-[calc(var(--radius-app)+2px)]" />
        ))}
      </div>
    </div>
  )
}
