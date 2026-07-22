export interface LandingPreviewCandidate {
  name: string
  category: string
  role: string
  city: string
  availability: string
  skills: string[]
}

export interface LandingPreviewMatch<T extends LandingPreviewCandidate> {
  talent: T
  reasons: string[]
}

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'available',
  'for',
  'in',
  'of',
  'the',
  'this',
  'who',
  'with',
])

const NORMALISATIONS: Array<[RegExp, string]> = [
  [/\bdec\b/g, 'december'],
  [/\bjan\b/g, 'january'],
  [/short[ -]form/g, 'shortform'],
  [/photo(?:grapher|graphy)?[ -]?video(?:grapher|graphy)?/g, 'photo video'],
]

function normalise(value: string) {
  let normalised = value.toLowerCase().replace(/&/g, ' and ')
  for (const [pattern, replacement] of NORMALISATIONS) {
    normalised = normalised.replace(pattern, replacement)
  }
  return normalised.replace(/[^a-z0-9]+/g, ' ').trim()
}

function queryTerms(query: string) {
  return [...new Set(normalise(query).split(' ').filter(term => term.length > 1 && !STOP_WORDS.has(term)))]
}

function containsTerm(value: string, term: string) {
  return value.split(' ').includes(term)
}

function readableAvailability(value: string) {
  return value.replace('Available ', '')
}

export function findLandingPreviewMatches<T extends LandingPreviewCandidate>(
  query: string,
  candidates: readonly T[],
  limit = 3,
): LandingPreviewMatch<T>[] {
  const terms = queryTerms(query)
  if (terms.length === 0) return []

  return candidates
    .map((talent, index) => {
      const category = normalise(talent.category)
      const role = normalise(talent.role)
      const city = normalise(talent.city)
      const availability = normalise(talent.availability)
      const skills = talent.skills.map(skill => ({ label: skill, value: normalise(skill) }))
      const matchedSkills = skills.filter(skill => terms.some(term => containsTerm(skill.value, term)))
      const matchedCity = terms.some(term => containsTerm(city, term))
      const matchedAvailability = terms.some(term => containsTerm(availability, term))
      const matchedRole = terms.filter(term => containsTerm(role, term) || containsTerm(category, term))

      const score = terms.reduce((total, term) => {
        if (skills.some(skill => containsTerm(skill.value, term))) return total + 5
        if (containsTerm(role, term)) return total + 4
        if (containsTerm(category, term)) return total + 3
        if (containsTerm(city, term)) return total + 2
        if (containsTerm(availability, term)) return total + 2
        return total
      }, 0)

      const reasons = [
        ...matchedSkills.map(skill => skill.label),
        ...(matchedCity ? [`Based in ${talent.city}`] : []),
        ...(matchedAvailability ? [readableAvailability(talent.availability)] : []),
        ...(matchedRole.length > 0 && matchedSkills.length === 0 ? [talent.role] : []),
      ].slice(0, 3)

      return { talent, reasons, score, index }
    })
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, Math.max(0, limit))
    .map(({ talent, reasons }) => ({ talent, reasons }))
}
