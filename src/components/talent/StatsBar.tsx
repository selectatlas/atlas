import type { LucideIcon } from 'lucide-react'

interface StatsBarProps {
  items: Array<{
    icon: LucideIcon
    label: string
    value: string
  }>
}

export function StatsBar({ items }: StatsBarProps) {
  if (items.length === 0) return null

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
      {items.map((item, i) => (
        <div
          key={i}
          className="flex min-w-[120px] shrink-0 items-center gap-2 rounded-xl border border-border/80 bg-card px-3 py-2.5"
        >
          <item.icon className="size-4 shrink-0 text-primary" strokeWidth={1.8} />
          <div className="min-w-0">
            <p className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider leading-none mb-0.5">
              {item.label}
            </p>
            <p className="text-foreground text-xs font-medium leading-tight truncate max-w-[140px]">
              {item.value}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
