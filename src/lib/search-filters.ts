import { FILTER_BY_KEY, TALENT_FILTERS, type FilterKey, type TalentFilterDefinition } from '@/lib/filter-taxonomy'

export interface NumericRange {
  min?: number
  max?: number
}

export type SearchFilterValue = string | string[] | boolean | NumericRange
export type SearchFilters = Partial<Record<FilterKey, SearchFilterValue>>

export type FilterParseResult =
  | { ok: true; filters: SearchFilters }
  | { ok: false; error: string }

const MAX_MULTI_VALUES = 30
const MAX_TEXT_LENGTH = 100

function normaliseText(value: unknown) {
  return typeof value === 'string' ? value.trim().slice(0, MAX_TEXT_LENGTH) : ''
}

function normaliseMulti(values: unknown, definition: TalentFilterDefinition): string[] | null {
  const source = Array.isArray(values) ? values : typeof values === 'string' ? [values] : null
  if (!source) return null

  const allowed = new Set(definition.options?.map(option => option.value) ?? [])
  const normalised = [...new Set(source
    .map(normaliseText)
    .filter(Boolean)
    .slice(0, MAX_MULTI_VALUES))]

  if (!definition.allowCustom && allowed.size > 0 && normalised.some(value => !allowed.has(value))) return null
  return normalised
}

function normaliseRange(value: unknown, definition: TalentFilterDefinition): NumericRange | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const source = value as Record<string, unknown>
  const min = source.min === '' || source.min == null ? undefined : Number(source.min)
  const max = source.max === '' || source.max == null ? undefined : Number(source.max)
  if (min !== undefined && !Number.isFinite(min)) return null
  if (max !== undefined && !Number.isFinite(max)) return null
  if (min !== undefined && definition.min !== undefined && min < definition.min) return null
  if (max !== undefined && definition.max !== undefined && max > definition.max) return null
  if (min !== undefined && max !== undefined && min > max) return null
  return min === undefined && max === undefined ? {} : { min, max }
}

function normaliseValue(value: unknown, definition: TalentFilterDefinition): SearchFilterValue | null {
  if (definition.kind === 'multi') return normaliseMulti(value, definition)
  if (definition.kind === 'range') return normaliseRange(value, definition)
  if (definition.kind === 'boolean') return typeof value === 'boolean' ? value : null

  const text = normaliseText(value)
  if (!text) return ''
  if (definition.options && !definition.allowCustom && !definition.options.some(option => option.value === text)) return null
  return text
}

export function parseSearchFilterObject(input: unknown): FilterParseResult {
  if (input == null) return { ok: true, filters: {} }
  if (typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'filters must be an object' }

  const filters: SearchFilters = {}
  for (const [key, rawValue] of Object.entries(input as Record<string, unknown>)) {
    const definition = FILTER_BY_KEY.get(key)
    if (!definition) return { ok: false, error: `Unknown filter: ${key}` }
    const value = normaliseValue(rawValue, definition)
    if (value === null) return { ok: false, error: `Invalid value for filter: ${key}` }
    if (value === '' || (Array.isArray(value) && value.length === 0) || (typeof value === 'object' && Object.keys(value).length === 0)) continue
    filters[key as FilterKey] = value
  }
  return { ok: true, filters }
}

export function parseSearchFilterParams(params: URLSearchParams): FilterParseResult {
  const raw: Record<string, unknown> = {}
  const allowedAuxiliary = new Set(['page', 'limit', 'sort', 'q'])

  for (const key of new Set(params.keys())) {
    if (allowedAuxiliary.has(key)) continue
    if (key.endsWith('_min') || key.endsWith('_max')) {
      const filterKey = key.replace(/_(min|max)$/, '')
      const definition = FILTER_BY_KEY.get(filterKey)
      if (!definition || definition.kind !== 'range') return { ok: false, error: `Unknown filter: ${key}` }
      const range = (raw[filterKey] ?? {}) as Record<string, unknown>
      range[key.endsWith('_min') ? 'min' : 'max'] = params.get(key)
      raw[filterKey] = range
      continue
    }

    const definition = FILTER_BY_KEY.get(key)
    if (!definition) return { ok: false, error: `Unknown filter: ${key}` }
    if (definition.kind === 'multi') raw[key] = params.getAll(key)
    else if (definition.kind === 'boolean') {
      const value = params.get(key)
      if (value !== 'true' && value !== 'false') return { ok: false, error: `Invalid value for filter: ${key}` }
      raw[key] = value === 'true'
    } else raw[key] = params.get(key)
  }

  return parseSearchFilterObject(raw)
}

export function serializeSearchFilters(filters: SearchFilters): URLSearchParams {
  const params = new URLSearchParams()
  for (const definition of TALENT_FILTERS) {
    const value = filters[definition.key as FilterKey]
    if (value === undefined) continue
    if (Array.isArray(value)) value.forEach(item => params.append(definition.key, item))
    else if (typeof value === 'object') {
      if (value.min !== undefined) params.set(`${definition.key}_min`, String(value.min))
      if (value.max !== undefined) params.set(`${definition.key}_max`, String(value.max))
    } else params.set(definition.key, String(value))
  }
  return params
}

export function filtersToDatabase(filters: SearchFilters) {
  const databaseFilters: Record<string, unknown> = {}
  const attributes: Record<string, SearchFilterValue> = {}
  const sensitive: Record<string, SearchFilterValue> = {}

  for (const [key, value] of Object.entries(filters)) {
    const definition = FILTER_BY_KEY.get(key)
    if (!definition) continue
    if (definition.storage === 'public_attributes') attributes[key] = value
    else if (definition.storage === 'sensitive_preferences') sensitive[key] = value
    else databaseFilters[key] = value
  }

  if (Object.keys(attributes).length > 0) databaseFilters.attributes = attributes
  if (Object.keys(sensitive).length > 0) databaseFilters.sensitive = sensitive
  return databaseFilters
}

export function activeFilterCount(filters: SearchFilters) {
  return Object.keys(filters).length
}
