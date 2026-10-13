import 'server-only'

import { and, eq, inArray, or } from 'drizzle-orm'
import { db } from './db'
import { children, classRegistrations, classTeachingRequests, guardians, schedules, sessionClassrooms, sessions, users } from './schema'
import { getAdminModuleAccess } from './user-groups'

export async function getClassHubAccess(userId: string, scheduleId: string) {
  const [classRow] = await db.select({
    scheduleId: schedules.id,
    scheduleStatus: schedules.status,
    period: schedules.period,
    className: classTeachingRequests.className,
    gradeRange: classTeachingRequests.gradeRange,
    teacherId: classTeachingRequests.guardianId,
    coTeacherId: classTeachingRequests.coTeacherId,
    sessionId: schedules.sessionId,
    sessionName: sessions.name,
    classroomName: sessionClassrooms.name,
  }).from(schedules)
    .innerJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
    .innerJoin(sessions, eq(schedules.sessionId, sessions.id))
    .leftJoin(sessionClassrooms, eq(schedules.sessionClassroomId, sessionClassrooms.id))
    .where(eq(schedules.id, scheduleId)).limit(1)

  if (!classRow) return null

  const [guardian, user] = await Promise.all([
    db.select({ familyId: guardians.familyId, role: guardians.role }).from(guardians).where(eq(guardians.id, userId)).limit(1).then((rows) => rows[0]),
    db.select({ familyId: users.familyId, role: users.role }).from(users).where(eq(users.id, userId)).limit(1).then((rows) => rows[0])
  ])
  const familyId = guardian?.familyId || user?.familyId || null
  const role = user?.role || guardian?.role
  const isAdmin = role === 'admin' || ((role === 'moderator' || role === 'member') && await getAdminModuleAccess(userId, 'class-requests'))
  const isTeacher = ['submitted', 'published'].includes(classRow.scheduleStatus) && (classRow.teacherId === userId || classRow.coTeacherId === userId)

  let isFamily = false
  if (familyId && classRow.scheduleStatus === 'published') {
    const [registration, studentTeacher] = await Promise.all([
      db.select({ id: classRegistrations.id }).from(classRegistrations).where(and(
        eq(classRegistrations.scheduleId, scheduleId),
        eq(classRegistrations.familyId, familyId),
        inArray(classRegistrations.status, ['registered', 'pending'])
      )).limit(1).then((rows) => rows[0]),
      db.select({ id: children.id }).from(children)
        .innerJoin(classTeachingRequests, or(eq(classTeachingRequests.studentTeacherChildId, children.id), eq(classTeachingRequests.studentCoTeacherChildId, children.id)))
        .innerJoin(schedules, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
        .where(and(eq(schedules.id, scheduleId), eq(children.familyId, familyId))).limit(1).then((rows) => rows[0])
    ])
    isFamily = Boolean(registration || studentTeacher)
  }

  return {
    ...classRow,
    familyId,
    canManage: Boolean(isTeacher || isAdmin),
    canView: Boolean(isTeacher || isAdmin || isFamily),
    isFamily,
  }
}
