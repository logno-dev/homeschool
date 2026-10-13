import 'server-only'

import { and, eq, inArray, or } from 'drizzle-orm'
import { db } from './db'
import { getConfiguredDateKey } from './app-time'
import { children, classRegistrations, classTeachingRequests, guardians, schedules, sessionClassrooms, sessions, users } from './schema'

export interface FamilyClassHubSummary {
  scheduleId: string
  className: string
  gradeRange: string
  period: string
  classroomName: string | null
  sessionId: string
  sessionName: string
  sessionStartDate: string
  sessionEndDate: string
  students: string[]
}

export async function getFamilyClassHubs(userId: string) {
  const [guardian, user] = await Promise.all([
    db.select({ familyId: guardians.familyId }).from(guardians).where(eq(guardians.id, userId)).limit(1).then((rows) => rows[0]),
    db.select({ familyId: users.familyId }).from(users).where(eq(users.id, userId)).limit(1).then((rows) => rows[0])
  ])
  const familyId = guardian?.familyId || user?.familyId
  if (!familyId) return { current: [] as FamilyClassHubSummary[], past: [] as FamilyClassHubSummary[] }

  const classFields = {
    scheduleId: schedules.id,
    className: classTeachingRequests.className,
    gradeRange: classTeachingRequests.gradeRange,
    period: schedules.period,
    classroomName: sessionClassrooms.name,
    sessionId: sessions.id,
    sessionName: sessions.name,
    sessionStartDate: sessions.startDate,
    sessionEndDate: sessions.endDate,
    childFirstName: children.firstName,
    childLastName: children.lastName,
  }
  const [registrations, studentTeachers] = await Promise.all([
    db.select(classFields).from(classRegistrations)
      .innerJoin(schedules, eq(classRegistrations.scheduleId, schedules.id))
      .innerJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
      .innerJoin(sessions, eq(schedules.sessionId, sessions.id))
      .leftJoin(sessionClassrooms, eq(schedules.sessionClassroomId, sessionClassrooms.id))
      .innerJoin(children, eq(classRegistrations.childId, children.id))
      .where(and(eq(classRegistrations.familyId, familyId), inArray(classRegistrations.status, ['registered', 'pending']), eq(schedules.status, 'published'))),
    db.select(classFields).from(schedules)
      .innerJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
      .innerJoin(sessions, eq(schedules.sessionId, sessions.id))
      .leftJoin(sessionClassrooms, eq(schedules.sessionClassroomId, sessionClassrooms.id))
      .innerJoin(children, or(eq(classTeachingRequests.studentTeacherChildId, children.id), eq(classTeachingRequests.studentCoTeacherChildId, children.id)))
      .where(and(eq(children.familyId, familyId), eq(schedules.status, 'published')))
  ])

  const bySchedule = new Map<string, FamilyClassHubSummary>()
  for (const row of [...registrations, ...studentTeachers]) {
    const existing = bySchedule.get(row.scheduleId)
    const studentName = `${row.childFirstName} ${row.childLastName}`.trim()
    if (existing) {
      if (!existing.students.includes(studentName)) existing.students.push(studentName)
    } else {
      bySchedule.set(row.scheduleId, {
        scheduleId: row.scheduleId,
        className: row.className,
        gradeRange: row.gradeRange,
        period: row.period,
        classroomName: row.classroomName,
        sessionId: row.sessionId,
        sessionName: row.sessionName,
        sessionStartDate: row.sessionStartDate,
        sessionEndDate: row.sessionEndDate,
        students: [studentName]
      })
    }
  }

  const today = await getConfiguredDateKey()
  const classes = [...bySchedule.values()].sort((a, b) => b.sessionStartDate.localeCompare(a.sessionStartDate) || a.period.localeCompare(b.period) || a.className.localeCompare(b.className))
  return { current: classes.filter((item) => item.sessionEndDate >= today), past: classes.filter((item) => item.sessionEndDate < today) }
}
