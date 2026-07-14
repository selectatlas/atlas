'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { FILTER_BY_KEY } from '@/lib/filter-taxonomy'
import { parseSearchFilterParams, serializeSearchFilters, type SearchFilters } from '@/lib/search-filters'

export function useSearchFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const filters = useMemo(() => {
    const parsed = parseSearchFilterParams(new URLSearchParams(searchParams.toString()))
    return parsed.ok ? parsed.filters : {}
  }, [searchParams])

  const setFilters = useCallback((next: SearchFilters) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const key of [...params.keys()]) {
      if (FILTER_BY_KEY.has(key) || key.endsWith('_min') && FILTER_BY_KEY.has(key.slice(0, -4)) || key.endsWith('_max') && FILTER_BY_KEY.has(key.slice(0, -4))) {
        params.delete(key)
      }
    }
    const encoded = serializeSearchFilters(next)
    encoded.forEach((value, key) => params.append(key, value))
    params.delete('page')
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [pathname, router, searchParams])

  return { filters, setFilters, resetFilters: () => setFilters({}) }
}
