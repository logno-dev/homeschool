import { getGradeRangeFromLabel } from './grades'

export const MIN_CLASS_CAPACITY = 10
export const MAX_CLASS_CAPACITY = 100
export const MAX_TEACHER_CLASS_FEE = 12

export const CLASS_TEACHING_ACCESS_MODES = ['closed', 'selected_groups', 'open'] as const
export type ClassTeachingAccessMode = typeof CLASS_TEACHING_ACCESS_MODES[number]

export function isClassTeachingAccessMode(value: unknown): value is ClassTeachingAccessMode {
  return CLASS_TEACHING_ACCESS_MODES.includes(value as ClassTeachingAccessMode)
}

export function parseClassTeachingGroupIds(value: unknown): string[] {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    return Array.isArray(parsed) ? [...new Set(parsed.filter((id): id is string => typeof id === 'string' && Boolean(id)))] : []
  } catch {
    return []
  }
}

export const CLASS_PERIODS = [
  { id: 'first', label: 'First Hour' },
  { id: 'second', label: 'Second Hour' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'third', label: 'Third Hour' },
] as const

export const CLASS_PERIOD_PREFERENCES = [
  ...CLASS_PERIODS,
  { id: 'any', label: 'Any Hour' },
] as const

export const CLASS_SLOT_GRADE_RANGES = [
  { value: 'Nursery', label: 'Nursery (0-1)' },
  { value: 'Toddler', label: 'Toddler (2-3)' },
  { value: 'Preschool', label: 'Preschool (4-5)' },
  { value: 'K-2', label: 'K-2' },
  { value: '3-5', label: '3-5' },
  { value: '6-8', label: '6-8' },
  { value: '9-12', label: '9-12' },
] as const

export const CLASS_SLOT_TARGET = 3
export const EARLY_CHILDHOOD_CLASS_SLOT_TARGET = 1

export function getClassSlotTarget(gradeRange: string) {
  const normalized = gradeRange.trim().toLowerCase()
  return ['nursery', 'toddler', 'preschool'].includes(normalized) ? EARLY_CHILDHOOD_CLASS_SLOT_TARGET : CLASS_SLOT_TARGET
}

export type ClassPeriodPreference = typeof CLASS_PERIOD_PREFERENCES[number]['id']

export function isClassPeriodPreference(value: unknown): value is ClassPeriodPreference {
  return CLASS_PERIOD_PREFERENCES.some((period) => period.id === value)
}

export function rangesOverlap(
  from: number | null,
  to: number | null,
  label: string,
  slotLabel: string
) {
  const requestFallback = getGradeRangeFromLabel(label)
  const normalizedLabel = label.trim().toLowerCase()
  const isAnyAge = normalizedLabel === 'all ages' || normalizedLabel === 'any age' || normalizedLabel === 'any ages'
  const requestFrom = isAnyAge ? requestFallback.from : from ?? requestFallback.from
  const requestTo = isAnyAge ? requestFallback.to : to ?? requestFallback.to
  const slot = getGradeRangeFromLabel(slotLabel)
  if (requestFrom === null || requestTo === null || slot.from === null || slot.to === null) return false
  return requestFrom <= slot.to && requestTo >= slot.from
}
