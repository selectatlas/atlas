import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-[53px] shrink-0 items-center gap-3 border-b border-border/80 px-4">
        <Skeleton className="size-8 rounded-lg" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="flex-1 space-y-3 px-4 py-4">
        <Skeleton className="h-12 w-2/5 rounded-2xl" />
        <Skeleton className="ml-auto h-12 w-2/5 rounded-2xl" />
        <Skeleton className="h-12 w-1/3 rounded-2xl" />
      </div>
      <div className="shrink-0 border-t border-border/80 px-4 py-3">
        <Skeleton className="h-10 rounded-xl" />
      </div>
    </div>
  )
}
