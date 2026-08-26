import 'server-only'
import { and, eq, inArray } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { db } from '@/lib/db'
import { classTeachingRequests, sessions, sessionRegistrationWindows, userGroupMemberships, userGroups } from '@/lib/schema'
import { getAppTimezone, parseAppDate } from '@/lib/app-time'

export const FAMILY_GROUP_SLUG = 'family'
export const TEACHER_GROUP_SLUG = 'teacher'

export async function getUserGroups(userId: string) {
  try {
    return await db
      .select({ group: userGroups })
      .from(userGroupMemberships)
      .innerJoin(userGroups, eq(userGroupMemberships.groupId, userGroups.id))
      .where(eq(userGroupMemberships.userId, userId))
  } catch (error) {
    console.error('Error loading user groups:', error)
    return []
  }
}

export async function addUserToGroup(userId: string, groupId: string) {
  await db.insert(userGroupMemberships).values({ id: randomUUID(), userId, groupId }).onConflictDoNothing()
}

export async function removeUserFromGroup(userId: string, groupId: string) {
  await db.delete(userGroupMemberships).where(and(eq(userGroupMemberships.userId, userId), eq(userGroupMemberships.groupId, groupId)))
}

export async function ensureFamilyGroupMembership(userId: string) {
  const [familyGroup] = await db.select({ id: userGroups.id }).from(userGroups).where(eq(userGroups.slug, FAMILY_GROUP_SLUG)).limit(1)
  if (familyGroup) await addUserToGroup(userId, familyGroup.id)
}

export async function syncTeacherGroupMembership(userId: string) {
  const [teacherGroup] = await db.select({ id: userGroups.id }).from(userGroups).where(eq(userGroups.slug, TEACHER_GROUP_SLUG)).limit(1)
  if (!teacherGroup) return

  const [approvedRequest] = await db
    .select({ id: classTeachingRequests.id })
    .from(classTeachingRequests)
    .where(and(eq(classTeachingRequests.guardianId, userId), eq(classTeachingRequests.status, 'approved')))
    .limit(1)

  if (approvedRequest) {
    await addUserToGroup(userId, teacherGroup.id)
  } else {
    await removeUserFromGroup(userId, teacherGroup.id)
  }
}

export async function getRegistrationAccess(sessionId: string, userId: string) {
  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1)
  if (!session) return { isOpen: false, session: null, reason: 'Session not found', group: null }

  const memberships = await getUserGroups(userId)
  const groupIds = memberships.map(({ group }) => group.id)
  const groupById = new Map(memberships.map(({ group }) => [group.id, group]))
  const windows = groupIds.length
    ? await db.select().from(sessionRegistrationWindows).where(and(eq(sessionRegistrationWindows.sessionId, sessionId), inArray(sessionRegistrationWindows.groupId, groupIds)))
    : []

  const now = new Date()
  const timezone = await getAppTimezone()
  const activeWindow = windows.find((window) => parseAppDate(window.startDate, timezone) <= now && now <= parseAppDate(window.endDate, timezone, true))
  if (activeWindow) {
    return { isOpen: true, session, reason: '', group: groupById.get(activeWindow.groupId) || null, windows }
  }

  const upcomingWindow = windows
    .filter((window) => parseAppDate(window.startDate, timezone) > now)
    .sort((a, b) => parseAppDate(a.startDate, timezone).getTime() - parseAppDate(b.startDate, timezone).getTime())[0]
  if (upcomingWindow) {
    return {
      isOpen: false,
      session,
      reason: `Registration opens on ${parseAppDate(upcomingWindow.startDate, timezone).toLocaleDateString('en-US', { timeZone: timezone })}`,
      group: groupById.get(upcomingWindow.groupId) || null,
      windows
    }
  }

  return { isOpen: false, session, reason: 'Registration is closed for your user groups.', group: null, windows }
}

export async function userBelongsToGroup(userId: string, slug: string) {
  const groups = await getUserGroups(userId)
  return groups.some(({ group }) => group.slug === slug)
}
