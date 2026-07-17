'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { BudgetBand, JobSort, WorkTypeFilter } from '@/lib/job-discovery'

export interface JobFilterValues {
  workType: WorkTypeFilter
  location: string
  budgetBand: BudgetBand
  sort: JobSort
}

interface JobFilterSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial: JobFilterValues
  workTypeOptions: Record<string, string>
  locationOptions: Record<string, string>
  budgetOptions: Record<string, string>
  sortOptions: Record<string, string>
  /** Live count of roles matching the draft filters; null hides the number. */
  fetchCount: (draft: JobFilterValues) => Promise<number | null>
  onApply: (values: JobFilterValues) => void
}

export function JobFilterSheet(props: JobFilterSheetProps) {
  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        {/* Remount per open so the draft always starts from the applied filters */}
        {props.open && <FilterSheetForm {...props} />}
      </SheetContent>
    </Sheet>
  )
}

function FilterSheetForm({
  initial, workTypeOptions, locationOptions, budgetOptions, sortOptions, fetchCount, onApply, onOpenChange,
}: JobFilterSheetProps) {
  const [draft, setDraft] = useState<JobFilterValues>(initial)
  const [count, setCount] = useState<number | null>(null)
  const countRequestRef = useRef(0)

  // Debounced live count so the apply button reads "Show N roles".
  useEffect(() => {
    const requestId = ++countRequestRef.current
    const timer = window.setTimeout(() => {
      fetchCount(draft)
        .then(value => {
          if (countRequestRef.current === requestId) setCount(value)
        })
        .catch(() => {
          if (countRequestRef.current === requestId) setCount(null)
        })
    }, 250)
    return () => window.clearTimeout(timer)
  }, [draft, fetchCount])

  function apply() {
    onApply(draft)
    onOpenChange(false)
  }

  function clearAll() {
    setDraft(current => ({ ...current, workType: 'all', location: 'all', budgetBand: 'any' }))
  }

  const hasActiveDraft = draft.workType !== 'all' || draft.location !== 'all' || draft.budgetBand !== 'any'

  return (
    <div className="mx-auto w-full max-w-lg">
      <SheetHeader className="px-0">
        <SheetTitle>Filter roles</SheetTitle>
        <SheetDescription>Narrow the feed; results update as you choose.</SheetDescription>
      </SheetHeader>
      <div className="grid grid-cols-1 gap-3 py-2">
        <SheetSelect
          label="Work type"
          options={workTypeOptions}
          value={draft.workType}
          onChange={value => setDraft(current => ({ ...current, workType: value as WorkTypeFilter }))}
        />
        <SheetSelect
          label="Location"
          options={locationOptions}
          value={draft.location}
          onChange={value => setDraft(current => ({ ...current, location: value }))}
        />
        <SheetSelect
          label="Rate"
          options={budgetOptions}
          value={draft.budgetBand}
          onChange={value => setDraft(current => ({ ...current, budgetBand: value as BudgetBand }))}
        />
        <SheetSelect
          label="Sort by"
          options={sortOptions}
          value={draft.sort}
          onChange={value => setDraft(current => ({ ...current, sort: value as JobSort }))}
        />
      </div>
      <SheetFooter className="flex-row gap-2 px-0">
        {hasActiveDraft && (
          <Button type="button" variant="outline" className="rounded-xl" onClick={clearAll}>
            Clear
          </Button>
        )}
        <Button type="button" className="flex-1 rounded-xl font-semibold" onClick={apply}>
          {count === null ? 'Show roles' : `Show ${count} ${count === 1 ? 'role' : 'roles'}`}
        </Button>
      </SheetFooter>
    </div>
  )
}

function SheetSelect({
  label, options, value, onChange,
}: {
  label: string
  options: Record<string, string>
  value: string
  onChange: (value: string) => void
}) {
  const fallback = Object.keys(options)[0] ?? ''
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      <Select items={options} value={value} onValueChange={next => onChange(next ?? fallback)}>
        <SelectTrigger aria-label={label} className="w-full rounded-xl">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(options).map(([optionValue, optionLabel]) => (
            <SelectItem key={optionValue} value={optionValue}>{optionLabel}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  )
}
