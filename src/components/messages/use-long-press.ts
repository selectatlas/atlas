'use client'

import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react'

const LONG_PRESS_MS = 450
const MOVE_CANCEL_PX = 10

/**
 * Long-press detection via pointer events (the app's established gesture
 * approach - see SwipeStack). Fires once per press; any pointer movement
 * beyond a small threshold, release, or cancel aborts it. The element using
 * this should also carry `select-none [-webkit-touch-callout:none]` so iOS
 * Safari doesn't open its text-selection callout mid-press.
 */
export function useLongPress(onLongPress: () => void) {
  const timerRef = useRef<number | undefined>(undefined)
  const originRef = useRef<{ x: number; y: number } | null>(null)

  const clear = useCallback(() => {
    window.clearTimeout(timerRef.current)
    originRef.current = null
  }, [])

  const onPointerDown = useCallback(
    (event: ReactPointerEvent) => {
      // Mouse users get the hover affordance; long-press is for touch/pen.
      if (event.pointerType === 'mouse') return
      originRef.current = { x: event.clientX, y: event.clientY }
      window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => {
        originRef.current = null
        onLongPress()
      }, LONG_PRESS_MS)
    },
    [onLongPress],
  )

  const onPointerMove = useCallback(
    (event: ReactPointerEvent) => {
      const origin = originRef.current
      if (!origin) return
      const dx = event.clientX - origin.x
      const dy = event.clientY - origin.y
      if (dx * dx + dy * dy > MOVE_CANCEL_PX * MOVE_CANCEL_PX) clear()
    },
    [clear],
  )

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: clear,
    onPointerCancel: clear,
    onPointerLeave: clear,
  }
}
