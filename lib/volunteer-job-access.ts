import 'server-only'
import { and, eq, gt, inArray, ne, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { volunteerAssignments, volunteerJobs, sessionVolunteerJobs, userGroupMemberships, userGroups, guardians } from '@/lib/schema'
import { volunteerJobAllowsGroups } from './volunteer-job-groups'

type JobAccessDatabase = Pick<typeof db, 'select'>

async function personalGroups(userIds: string[], connection: JobAccessDatabase = db) {
  const ids = [...new Set(userIds)]
  const rows = ids.length ? await connection.select({ userId: userGroupMemberships.userId, groupId: userGroupMemberships.groupId }).from(userGroupMemberships).innerJoin(userGroups, eq(userGroupMemberships.groupId, userGroups.id)).where(inArray(userGroupMemberships.userId, ids)) : []
  const groups = new Map<string, Set<string>>(ids.map(id => [id, new Set()]))
  for (const row of rows) groups.get(row.userId)?.add(row.groupId)
  return groups
}

export async function getVisibleVolunteerJobs(viewerUserId?: string, candidateIds?: string[]) {
  let guardianIds = candidateIds || []
  if (candidateIds === undefined && viewerUserId) {
    const [viewer] = await db.select({ familyId: guardians.familyId }).from(guardians).where(eq(guardians.id, viewerUserId)).limit(1)
    if (viewer?.familyId) guardianIds = (await db.select({ id: guardians.id }).from(guardians).where(eq(guardians.familyId, viewer.familyId))).map(guardian => guardian.id)
  }
  const [jobs, groups] = await Promise.all([
    db.select({ id: volunteerJobs.id, allowedGroupIds: volunteerJobs.allowedGroupIds }).from(volunteerJobs),
    personalGroups([...(viewerUserId ? [viewerUserId] : []), ...guardianIds]),
  ])
  const visible = new Map<string, string[]>()
  for (const job of jobs) {
    if (volunteerJobAllowsGroups(job.allowedGroupIds, groups.get(viewerUserId || '') || new Set())) {
      visible.set(job.id, guardianIds.filter(id => volunteerJobAllowsGroups(job.allowedGroupIds, groups.get(id) || new Set())))
    }
  }
  return visible
}

export async function canSignUpForVolunteerJob(jobId: string, sessionId: string, viewerUserId: string, guardianId: string, connection: JobAccessDatabase = db): Promise<boolean> {
  const [job] = await connection.select({ allowedGroupIds: volunteerJobs.allowedGroupIds }).from(volunteerJobs)
    .innerJoin(sessionVolunteerJobs, eq(sessionVolunteerJobs.volunteerJobId, volunteerJobs.id))
    .where(and(eq(volunteerJobs.id, jobId), eq(volunteerJobs.isActive, true), eq(sessionVolunteerJobs.sessionId, sessionId), eq(sessionVolunteerJobs.isActive, true))).limit(1)
  if (!job) return false
  const groups = await personalGroups([viewerUserId, guardianId], connection)
  return volunteerJobAllowsGroups(job.allowedGroupIds, groups.get(viewerUserId) || new Set()) && volunteerJobAllowsGroups(job.allowedGroupIds, groups.get(guardianId) || new Set())
}

function periodAliases(period: string) {
  switch (period) {
    case '1':
    case 'first': return ['1', 'first']
    case '2':
    case 'second': return ['2', 'second']
    case '3':
    case 'third': return ['3', 'third']
    default: return [period]
  }
}

export async function isLastResortVolunteerJobOpen(jobId: string, sessionId: string, period: string, connection: JobAccessDatabase = db, excludeFamilyId?: string) {
  const [target] = await connection.select({ isLastResort: volunteerJobs.isLastResort })
    .from(volunteerJobs)
    .innerJoin(sessionVolunteerJobs, eq(sessionVolunteerJobs.volunteerJobId, volunteerJobs.id))
    .where(and(eq(volunteerJobs.id, jobId), eq(sessionVolunteerJobs.sessionId, sessionId)))
    .limit(1)
  if (!target?.isLastResort) return true

  const regularJobs = await connection.select({
    id: volunteerJobs.id,
    quantityAvailable: sessionVolunteerJobs.quantityAvailable,
  }).from(sessionVolunteerJobs)
    .innerJoin(volunteerJobs, eq(sessionVolunteerJobs.volunteerJobId, volunteerJobs.id))
    .where(and(
      eq(sessionVolunteerJobs.sessionId, sessionId),
      eq(sessionVolunteerJobs.isActive, true),
      eq(volunteerJobs.isActive, true),
      eq(volunteerJobs.isLastResort, false),
      inArray(sessionVolunteerJobs.jobType, ['period_based', 'period'])
    ))

  if (!regularJobs.length) return true
  const now = new Date().toISOString()
  const assignments = await connection.select({ volunteerJobId: volunteerAssignments.volunteerJobId })
    .from(volunteerAssignments)
    .where(and(
      eq(volunteerAssignments.sessionId, sessionId),
      inArray(volunteerAssignments.volunteerJobId, regularJobs.map(job => job.id)),
      inArray(volunteerAssignments.period, periodAliases(period)),
      excludeFamilyId ? ne(volunteerAssignments.familyId, excludeFamilyId) : undefined,
      or(
        inArray(volunteerAssignments.status, ['assigned', 'pending']),
        and(eq(volunteerAssignments.status, 'hold'), gt(volunteerAssignments.holdExpiresAt, now))
      )
    ))

  const counts = new Map<string, number>()
  for (const assignment of assignments) {
    if (assignment.volunteerJobId) counts.set(assignment.volunteerJobId, (counts.get(assignment.volunteerJobId) || 0) + 1)
  }
  return regularJobs.every(job => (counts.get(job.id) || 0) >= job.quantityAvailable)
}

export async function validateVolunteerJobGroups(value: unknown): Promise<string[]> {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.some(id => typeof id !== 'string' || !id)) throw new Error('Allowed user groups must be a list of group IDs')
  const ids = [...new Set(value)] as string[]
  const groups = ids.length ? await db.select({ id: userGroups.id }).from(userGroups).where(inArray(userGroups.id, ids)) : []
  if (groups.length !== ids.length) throw new Error('One or more selected user groups no longer exist')
  return ids
}
