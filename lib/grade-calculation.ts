/**
 * Utility functions for calculating current grade based on grade year system
 */

// Grade level mapping for calculations
const GRADE_LEVELS = {
  'K': 0,
  '1': 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  '11': 11,
  '12': 12
} as const

const GRADE_NAMES = ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'] as const

/**
 * Calculate the current grade for a child based on their grade year and level
 * @param gradeYear - The year the child was in the specified grade level
 * @param gradeLevel - The grade level they were in that year (K, 1, 2, etc.)
 * @param currentDate - Optional current date (defaults to today)
 * @returns The current grade level as a string, or null if calculation fails
 */
export function calculateCurrentGrade(
  gradeYear: number | null,
  gradeLevel: string | null,
  currentDate: Date = new Date()
): string | null {
  if (!gradeYear || !gradeLevel) {
    return null
  }

  // Validate grade level
  if (!(gradeLevel in GRADE_LEVELS)) {
    return null
  }

  const currentYear = currentDate.getFullYear()
  const currentMonth = currentDate.getMonth() + 1 // getMonth() returns 0-11
  const currentDay = currentDate.getDate()

  // Determine if we've passed September 1st of the current year
  const hasPassedSeptember1 = currentMonth > 9 || (currentMonth === 9 && currentDay >= 1)

  // Calculate years since the reference grade
  let yearsSinceGrade: number
  if (hasPassedSeptember1) {
    yearsSinceGrade = currentYear - gradeYear
  } else {
    yearsSinceGrade = currentYear - gradeYear - 1
  }

  // Calculate current grade level
  const baseGradeLevel = GRADE_LEVELS[gradeLevel as keyof typeof GRADE_LEVELS]
  const currentGradeLevel = baseGradeLevel + yearsSinceGrade

  // Ensure grade level is within valid range
  if (currentGradeLevel < 0 || currentGradeLevel >= GRADE_NAMES.length) {
    return null
  }

  return GRADE_NAMES[currentGradeLevel]
}

/**
 * Get the school year for a given date
 * School year runs from September 1 to August 31
 * @param date - The date to get the school year for
 * @returns The school year (e.g., 2024 for the 2024-2025 school year)
 */
export function getSchoolYear(date: Date = new Date()): number {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()

  // If before September 1, we're still in the previous school year
  if (month < 9 || (month === 9 && day < 1)) {
    return year - 1
  }

  return year
}

/**
 * Check if a date is before September 1st of its year
 * @param date - The date to check
 * @returns True if the date is before September 1st
 */
export function isBeforeSeptember1(date: Date = new Date()): boolean {
  const month = date.getMonth() + 1
  const day = date.getDate()
  return month < 9 || (month === 9 && day < 1)
}

/**
 * Convert a grade level string to a numeric value for calculations
 * @param gradeLevel - The grade level (K, 1, 2, etc.)
 * @returns Numeric value or null if invalid
 */
export function gradeToNumber(gradeLevel: string): number | null {
  if (gradeLevel in GRADE_LEVELS) {
    return GRADE_LEVELS[gradeLevel as keyof typeof GRADE_LEVELS]
  }
  return null
}

/**
 * Convert a numeric grade level to a string
 * @param gradeNumber - The numeric grade level (0 for K, 1 for 1st, etc.)
 * @returns Grade level string or null if invalid
 */
export function numberToGrade(gradeNumber: number): string | null {
  if (gradeNumber >= 0 && gradeNumber < GRADE_NAMES.length) {
    return GRADE_NAMES[gradeNumber]
  }
  return null
}