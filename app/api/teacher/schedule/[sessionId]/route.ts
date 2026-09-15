import { and, eq, inArray, or } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { children, classRegistrations, classTeachingRequests, schedules, sessionClassrooms } from '@/lib/schema'
import { getAuthenticatedUserSession } from '@/lib/server-auth'
import { getGuardianById } from '@/lib/database'

export async function GET(_request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const auth = await getAuthenticatedUserSession()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const guardian = await getGuardianById(auth.session.user.id)
  if (!guardian) return NextResponse.json({ error: 'Guardian not found' }, { status: 404 })
  const { sessionId } = await params

  const teachingClasses = await db
    .select({
      scheduleId: schedules.id,
      period: schedules.period,
      className: classTeachingRequests.className,
      classroomName: sessionClassrooms.name,
      studentTeacherChildId: classTeachingRequests.studentTeacherChildId
    })
    .from(schedules)
    .innerJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
    .innerJoin(sessionClassrooms, eq(schedules.sessionClassroomId, sessionClassrooms.id))
    .where(and(
      eq(schedules.sessionId, sessionId),
      inArray(schedules.status, ['submitted', 'published']),
      or(eq(classTeachingRequests.guardianId, guardian.id), eq(classTeachingRequests.coTeacherId, guardian.id))
    ))

  if (!teachingClasses.length) return NextResponse.json({ classes: [] })
  const scheduleIds = teachingClasses.map((entry) => entry.scheduleId)
  const studentTeacherIds = teachingClasses.map((entry) => entry.studentTeacherChildId).filter((id): id is string => Boolean(id))
  const [registeredStudents, studentTeachers] = await Promise.all([
    db
      .select({ scheduleId: classRegistrations.scheduleId, id: children.id, firstName: children.firstName, lastName: children.lastName, grade: children.grade, allergies: children.allergies })
      .from(classRegistrations)
      .innerJoin(children, eq(classRegistrations.childId, children.id))
      .where(and(inArray(classRegistrations.scheduleId, scheduleIds), eq(classRegistrations.status, 'registered'))),
    studentTeacherIds.length
      ? db.select({ id: children.id, firstName: children.firstName, lastName: children.lastName, grade: children.grade, allergies: children.allergies }).from(children).where(inArray(children.id, studentTeacherIds))
      : []
  ])
  const studentTeacherById = new Map(studentTeachers.map((student) => [student.id, student]))

  return NextResponse.json({
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
