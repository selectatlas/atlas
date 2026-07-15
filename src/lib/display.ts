export function nameInitial(name: string | null | undefined, fallback = '?'): string {
  const trimmed = name?.trim()
  if (!trimmed) return fallback
  return trimmed[0]!.toUpperCase()
}

export function portfolioImageAlt(item: {
  title?: string | null
  type: string
  description?: string | null
}): string {
  const title = item.title?.trim()
  if (title) return title
  const description = item.description?.trim()
  if (description) return description.slice(0, 120)
  if (item.type === 'video') return 'Portfolio video'
  if (item.type === 'image') return 'Portfolio image'
  return 'Portfolio link'
}
