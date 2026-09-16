import { and, eq, inArray, or } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { children, classRegistrations, classTeachingRequests, guardians, schedules, sessionClassrooms, sessionRegistrationWindows, sessions } from '@/lib/schema'
import { getAuthenticatedUserSession } from '@/lib/server-auth'
import { getGuardianById } from '@/lib/database'
import { getAppTimezone, parseAppDate } from '@/lib/app-time'

export async function GET(_request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const auth = await getAuthenticatedUserSession()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const guardian = await getGuardianById(auth.session.user.id)
  if (!guardian) return NextResponse.json({ error: 'Guardian not found' }, { status: 404 })
  const { sessionId } = await params

  const reviewSchedule = await db
    .select({
      scheduleId: schedules.id,
      period: schedules.period,
      className: classTeachingRequests.className,
      gradeRange: classTeachingRequests.gradeRange,
      classroomName: sessionClassrooms.name,
      classroomId: sessionClassrooms.id,
      classroomDescription: sessionClassrooms.description,
      guardianId: classTeachingRequests.guardianId,
      coTeacherId: classTeachingRequests.coTeacherId,
      teacherName: classTeachingRequests.teacherName,
      guardianFirstName: guardians.firstName,
      guardianLastName: guardians.lastName,
      studentTeacherChildId: classTeachingRequests.studentTeacherChildId,
    })
    .from(schedules)
    .innerJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
    .innerJoin(sessionClassrooms, eq(schedules.sessionClassroomId, sessionClassrooms.id))
    .leftJoin(guardians, eq(classTeachingRequests.guardianId, guardians.id))
    .where(and(
      eq(schedules.sessionId, sessionId),
      inArray(schedules.status, ['submitted', 'published'])
    ))

  const teachingClasses = reviewSchedule.filter((entry) => entry.guardianId === guardian.id || entry.coTeacherId === guardian.id)
  if (!teachingClasses.length) return NextResponse.json({ classes: [], reviewSchedule: [], classrooms: [], registrationStarted: false })
  const scheduleIds = teachingClasses.map((entry) => entry.scheduleId)
  const studentTeacherIds = reviewSchedule.map((entry) => entry.studentTeacherChildId).filter((id): id is string => Boolean(id))
  const [registeredStudents, studentTeachers, sessionRows, registrationWindows] = await Promise.all([
    db
      .select({ scheduleId: classRegistrations.scheduleId, id: children.id, firstName: children.firstName, lastName: children.lastName, grade: children.grade, allergies: children.allergies })
      .from(classRegistrations)
      .innerJoin(children, eq(classRegistrations.childId, children.id))
      .where(and(inArray(classRegistrations.scheduleId, scheduleIds), eq(classRegistrations.status, 'registered'))),
    studentTeacherIds.length
      ? db.select({ id: children.id, firstName: children.firstName, lastName: children.lastName, grade: children.grade, allergies: children.allergies }).from(children).where(inArray(children.id, studentTeacherIds))
      : [],
    db.select({ registrationStartDate: sessions.registrationStartDate, teacherRegistrationStartDate: sessions.teacherRegistrationStartDate }).from(sessions).where(eq(sessions.id, sessionId)).limit(1),
    db.select({ startDate: sessionRegistrationWindows.startDate }).from(sessionRegistrationWindows).where(eq(sessionRegistrationWindows.sessionId, sessionId))
  ])
  const studentTeacherById = new Map(studentTeachers.map((student) => [student.id, student]))
  const session = sessionRows[0]
  const timezone = await getAppTimezone()
  const registrationStarts = [session?.registrationStartDate, session?.teacherRegistrationStartDate, ...registrationWindows.map((window) => window.startDate)].filter((date): date is string => Boolean(date))
  const registrationStarted = registeredStudents.length > 0 || registrationStarts.some((date) => new Date() >= parseAppDate(date, timezone))
  const classrooms = Array.from(new Map(reviewSchedule.map((entry) => [entry.classroomId, { id: entry.classroomId, name: entry.classroomName, description: entry.classroomDescription }])).values())

  return NextResponse.json({
    registrationStarted,
    classrooms,
    reviewSchedule: reviewSchedule.map((entry) => {
      const studentTeacher = entry.studentTeacherChildId ? studentTeacherById.get(entry.studentTeacherChildId) : undefined
      return {
        id: entry.scheduleId,
        classroomId: entry.classroomId,
        period: entry.period,
        className: entry.className,
        gradeRange: entry.gradeRange,
        teacherName: studentTeacher
          ? `${studentTeacher.firstName} ${studentTeacher.lastName}`
          : entry.teacherName || [entry.guardianFirstName, entry.guardianLastName].filter(Boolean).join(' ') || 'Teacher'
      }
    }),
    classes: teachingClasses.map((entry) => {
      const roster = registeredStudents.filter((student) => student.scheduleId === entry.scheduleId).map(({ scheduleId: _scheduleId, ...student }) => ({ ...student, role: 'student' }))
      const studentTeacher = entry.studentTeacherChildId ? studentTeacherById.get(entry.studentTeacherChildId) : undefined
      return {
        scheduleId: entry.scheduleId,
        className: entry.className,
        classroomName: entry.classroomName,
        period: entry.period,
        roster: studentTeacher
          ? [{ ...studentTeacher, role: 'student_teacher' }, ...roster.filter((student) => student.id !== studentTeacher.id)]
          : roster
      }
    })
  })
}
