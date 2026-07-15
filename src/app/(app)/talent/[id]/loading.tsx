import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="pb-24">
      <Skeleton className="h-48 w-full rounded-2xl sm:h-56" />
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 space-y-8">
          <Skeleton className="h-16 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-full max-w-3xl" />
            <Skeleton className="h-4 w-2/3 max-w-2xl" />
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-56 rounded-xl" />
        </div>
      </div>
    </div>
  )
}
