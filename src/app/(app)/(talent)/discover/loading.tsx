import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="space-y-8 py-2">
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-12 rounded-xl" />
      <div className="mx-auto w-full max-w-md">
        <Skeleton className="h-[420px] rounded-2xl" />
      </div>
    </div>
  )
}
