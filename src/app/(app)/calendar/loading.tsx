import { Skeleton } from '@/components/ui/states'

export default function CalendarLoading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading calendar">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-[28rem] w-full rounded-[calc(var(--radius-app)+2px)]" />
    </div>
  )
}
