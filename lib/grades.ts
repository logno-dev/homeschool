export const GRADE_ORDER = ['K', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'] as const

const GRADE_INDEX = new Map(GRADE_ORDER.map((grade, index) => [grade.toLowerCase(), index]))

export function normalizeGradeLabel(value: string | null | undefined): string | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase().replace(/\s*grade\s*$/, '')

  if (normalized === 'k' || normalized === 'kindergarten') {
    return 'K'
  }

  const numericMatch = normalized.match(/^([1-9]|1[0-2])(?:st|nd|rd|th)?$/)
  if (numericMatch) {
    const gradeNumber = Number(numericMatch[1])
    const suffix = gradeNumber === 1 ? 'st' : gradeNumber === 2 ? 'nd' : gradeNumber === 3 ? 'rd' : 'th'
    return `${gradeNumber}${suffix}`
  }

  const fromMap = GRADE_ORDER.find((grade) => grade.toLowerCase() === normalized)
  return fromMap || null
}

export function getGradeIndex(value: string | null | undefined): number | null {
  const normalized = normalizeGradeLabel(value)
  if (!normalized) return null
  const index = GRADE_INDEX.get(normalized.toLowerCase())
  return typeof index === 'number' ? index : null
}

export function getGradeRangeFromLabel(label: string | null | undefined) {
  if (!label) {
    return { from: null, to: null }
  }

  const normalized = label.trim().toLowerCase()
  if (normalized === 'all ages') {
    return { from: 0, to: GRADE_ORDER.length - 1 }
  }

  const parts = normalized.split('-').map((part) => part.trim())
  if (parts.length === 2) {
    const from = getGradeIndex(parts[0])
    const to = getGradeIndex(parts[1])
    if (from !== null && to !== null) {
      return { from, to }
    }
  }

  const single = getGradeIndex(normalized)
  if (single !== null) {
    return { from: single, to: single }
  }

  return { from: null, to: null }
}

export function isGradeWithinRange(
  grade: string | null | undefined,
  rangeFrom: number | null | undefined,
  rangeTo: number | null | undefined,
  fallbackLabel?: string | null
) {
  const gradeIndex = getGradeIndex(grade)
  if (gradeIndex === null) {
    return true
  }

  const fallback = getGradeRangeFromLabel(fallbackLabel || null)
  const min = typeof rangeFrom === 'number' ? rangeFrom : fallback.from
  const max = typeof rangeTo === 'number' ? rangeTo : fallback.to

  if (min === null || max === null) {
    return true
  }

  return gradeIndex >= min && gradeIndex <= max
}
