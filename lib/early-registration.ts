import 'server-only'
import { db } from './db'
import { classTeachingRequests } from './schema'
import { eq, and, inArray } from 'drizzle-orm'
import { getGuardianById, getGuardiansByFamily } from './database'

/**
 * Check if any parent in the family is registered to teach for the specified session
 * This qualifies the family for early registration access
 */
export async function checkFamilyTeacherStatus(familyId: string, sessionId: string): Promise<boolean> {
  try {
    const familyGuardians = await getGuardiansByFamily(familyId)

    if (!familyGuardians.length) {
      return false
    }

    // Check if any guardian has teaching requests for this session
    const guardianIds = familyGuardians.map(g => g.id)
    
    const teachingRequests = await db
      .select({ id: classTeachingRequests.id })
      .from(classTeachingRequests)
      .where(
        and(
          eq(classTeachingRequests.sessionId, sessionId),
          inArray(classTeachingRequests.guardianId, guardianIds)
        )
      )
      .limit(1) // We only need to know if at least one exists

    return teachingRequests.length > 0
  } catch (error) {
    console.error('Error checking family teacher status:', error)
    return false
  }
}

/**
 * Check if a specific user's family qualifies for early registration
 * This is a convenience function that gets the family ID first
 */
export async function checkUserFamilyTeacherStatus(userId: string, sessionId: string): Promise<boolean> {
  try {
    const guardian = await getGuardianById(userId)

    if (!guardian?.familyId) {
      return false
    }

    return checkFamilyTeacherStatus(guardian.familyId, sessionId)
  } catch (error) {
    console.error('Error checking user family teacher status:', error)
    return false
  }
}
