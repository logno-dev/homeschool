import 'server-only'
import { getGuardianById, getGuardiansByFamily } from './database'
import { userBelongsToGroup } from './user-groups'

/**
 * Check if any parent in the family is registered to teach for the specified session
 * This qualifies the family for early registration access
 */
export async function checkFamilyTeacherStatus(familyId: string, sessionId: string): Promise<boolean> {
  const familyGuardians = await getGuardiansByFamily(familyId)
  return (await Promise.all(familyGuardians.map((guardian) => userBelongsToGroup(guardian.id, 'teacher')))).some(Boolean)
}

/**
 * Check if a specific user's family qualifies for early registration
 * This is a convenience function that gets the family ID first
 */
export async function checkUserFamilyTeacherStatus(userId: string, sessionId: string): Promise<boolean> {
  const guardian = await getGuardianById(userId)
  return guardian?.familyId ? checkFamilyTeacherStatus(guardian.familyId, sessionId) : false
}
