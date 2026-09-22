import { and, eq, inArray, or } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { children, classRegistrations, classTeachingRequests, guardians, schedules, sessionClassrooms, sessionRegistrationWindows, sessions, volunteerAssignments } from '@/lib/schema'
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
      coTeacherName: classTeachingRequests.coTeacher,
      teacherName: classTeachingRequests.teacherName,
      guardianFirstName: guardians.firstName,
      guardianLastName: guardians.lastName,
      studentTeacherChildId: classTeachingRequests.studentTeacherChildId,
      studentCoTeacherChildId: classTeachingRequests.studentCoTeacherChildId,
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
  const studentTeacherIds = reviewSchedule.flatMap((entry) => [entry.studentTeacherChildId, entry.studentCoTeacherChildId]).filter((id): id is string => Boolean(id))
  const [registeredStudents, studentTeachers, classHelpers, sessionRows, registrationWindows] = await Promise.all([
    db
      .select({ scheduleId: classRegistrations.scheduleId, status: classRegistrations.status, id: children.id, familyId: children.familyId, firstName: children.firstName, lastName: children.lastName, grade: children.grade, allergies: children.allergies })
      .from(classRegistrations)
      .innerJoin(children, eq(classRegistrations.childId, children.id))
      .where(and(inArray(classRegistrations.scheduleId, scheduleIds), inArray(classRegistrations.status, ['registered', 'waitlisted']))),
    studentTeacherIds.length
      ? db.select({ id: children.id, familyId: children.familyId, firstName: children.firstName, lastName: children.lastName, grade: children.grade, allergies: children.allergies }).from(children).where(inArray(children.id, studentTeacherIds))
      : [],
    db
      .select({ scheduleId: volunteerAssignments.scheduleId, id: guardians.id, firstName: guardians.firstName, lastName: guardians.lastName, email: guardians.email })
      .from(volunteerAssignments)
      .innerJoin(guardians, eq(volunteerAssignments.guardianId, guardians.id))
      .where(and(
        inArray(volunteerAssignments.scheduleId, scheduleIds),
        eq(volunteerAssignments.volunteerType, 'helper'),
        eq(volunteerAssignments.status, 'assigned')
      )),
    db.select({ registrationStartDate: sessions.registrationStartDate, teacherRegistrationStartDate: sessions.teacherRegistrationStartDate }).from(sessions).where(eq(sessions.id, sessionId)).limit(1),
    db.select({ startDate: sessionRegistrationWindows.startDate }).from(sessionRegistrationWindows).where(eq(sessionRegistrationWindows.sessionId, sessionId))
  ])
  const familyIds = Array.from(new Set([...registeredStudents, ...studentTeachers].map((student) => student.familyId)))
  const parentRows = familyIds.length
    ? await db.select({ familyId: guardians.familyId, email: guardians.email }).from(guardians).where(inArray(guardians.familyId, familyIds))
    : []
  const parentEmailsByFamily = new Map<string, string[]>()
  parentRows.forEach((parent) => {
    const normalizedEmail = parent.email.trim()
    if (!normalizedEmail) return
    const emails = parentEmailsByFamily.get(parent.familyId) || []
    if (!emails.some((email) => email.toLowerCase() === normalizedEmail.toLowerCase())) emails.push(normalizedEmail)
    parentEmailsByFamily.set(parent.familyId, emails)
  })
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
      const studentCoTeacher = entry.studentCoTeacherChildId ? studentTeacherById.get(entry.studentCoTeacherChildId) : undefined
      return {
        id: entry.scheduleId,
        classroomId: entry.classroomId,
        period: entry.period,
        className: entry.className,
        gradeRange: entry.gradeRange,
        teacherName: studentTeacher
          ? `${studentTeacher.firstName} ${studentTeacher.lastName}`
          : entry.teacherName || [entry.guardianFirstName, entry.guardianLastName].filter(Boolean).join(' ') || 'Teacher',
        coTeacherName: studentCoTeacher ? `${studentCoTeacher.firstName} ${studentCoTeacher.lastName}` : entry.coTeacherName,
        isStudentCoTeacher: Boolean(studentCoTeacher)
      }
    }),
    classes: teachingClasses.map((entry) => {
      const classStudents = registeredStudents.filter((student) => student.scheduleId === entry.scheduleId)
      const roster = classStudents.filter((student) => student.status === 'registered').map(({ scheduleId: _scheduleId, status: _status, familyId, ...student }) => ({ ...student, parentEmails: parentEmailsByFamily.get(familyId) || [], role: 'student' }))
      const waitlist = classStudents.filter((student) => student.status === 'waitlisted').map(({ scheduleId: _scheduleId, status: _status, familyId, allergies: _allergies, ...student }) => ({ ...student, parentEmails: parentEmailsByFamily.get(familyId) || [] }))
      const studentTeacher = entry.studentTeacherChildId ? studentTeacherById.get(entry.studentTeacherChildId) : undefined
      const studentCoTeacher = entry.studentCoTeacherChildId ? studentTeacherById.get(entry.studentCoTeacherChildId) : undefined
      const withParentEmails = (student: NonNullable<typeof studentTeacher>, role: 'student_teacher' | 'student_co_teacher') => {
        const { familyId, ...studentData } = student
        return { ...studentData, parentEmails: parentEmailsByFamily.get(familyId) || [], role }
      }
      return {
        scheduleId: entry.scheduleId,
        className: entry.className,
        classroomName: entry.classroomName,
        period: entry.period,
        roster: [
          ...(studentTeacher ? [withParentEmails(studentTeacher, 'student_teacher')] : []),
          ...(studentCoTeacher ? [withParentEmails(studentCoTeacher, 'student_co_teacher')] : []),
          ...roster.filter((student) => student.id !== studentTeacher?.id && student.id !== studentCoTeacher?.id)
        ],
        waitlist,
        helpers: classHelpers
          .filter((helper) => helper.scheduleId === entry.scheduleId)
          .map(({ scheduleId: _scheduleId, ...helper }) => helper)
      }
    })
  })
}
