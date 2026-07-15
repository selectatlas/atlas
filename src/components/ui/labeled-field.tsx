'use client'

import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type LabeledFieldProps = {
  label: ReactNode
  className?: string
  children: ReactNode
}

export function LabeledField({ label, className, children }: LabeledFieldProps) {
  const id = useId()
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<{ id?: string }>, {
        id: (children as ReactElement<{ id?: string }>).props.id ?? id,
      })
    : children

  return (
    <div className={cn(className)}>
      <Label htmlFor={id} className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {control}
    </div>
  )
}
