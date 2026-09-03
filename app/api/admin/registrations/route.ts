import { NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import {
  classRegistrations,
  schedules,
  classTeachingRequests,
  sessionClassrooms,
  children,
  guardians,
  volunteerAssignments,
  volunteerJobs,
  sessionVolunteerJobs
} from '@/lib/schema'
import { and, eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { publishRegistrationUpdate } from '@/lib/registration-events'

export async function GET(request: Request) {
  try {
    const auth = await getAuthenticatedAdmin('registrations')
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const url = new URL(request.url)
    const sessionId = url.searchParams.get('sessionId')
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
    }

    const [registrationRows, scheduleRows, volunteerRows, volunteerJobRows, guardianRows, childRows, classroomRows] = await Promise.all([
      db
        .select({
          id: classRegistrations.id,
          status: classRegistrations.status,
          child: {
            id: children.id,
            firstName: children.firstName,
            lastName: children.lastName,
            grade: children.grade,
            familyId: children.familyId
          },
          schedule: {
            id: schedules.id,
            period: schedules.period
          },
          classTeachingRequest: {
            className: classTeachingRequests.className,
            teacherName: classTeachingRequests.teacherName
          },
          classroom: {
            name: sessionClassrooms.name
          }
        })
        .from(classRegistrations)
        .innerJoin(children, eq(classRegistrations.childId, children.id))
        .innerJoin(schedules, eq(classRegistrations.scheduleId, schedules.id))
        .innerJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
        .innerJoin(sessionClassrooms, eq(schedules.sessionClassroomId, sessionClassrooms.id))
        .where(eq(classRegistrations.sessionId, sessionId)),

      db
        .select({
          id: schedules.id,
          classroomId: sessionClassrooms.id,
          period: schedules.period,
           className: classTeachingRequests.className,
           teacherName: classTeachingRequests.teacherName,
           classroom: sessionClassrooms.name,
          teacherFirstName: guardians.firstName,
           teacherLastName: guardians.lastName,
           maxStudents: classTeachingRequests.maxStudents
        })
        .from(schedules)
        .innerJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
        .innerJoin(sessionClassrooms, eq(schedules.sessionClassroomId, sessionClassrooms.id))
        .innerJoin(guardians, eq(classTeachingRequests.guardianId, guardians.id))
        .where(eq(schedules.sessionId, sessionId)),

      db
        .select({
          id: volunteerAssignments.id,
          period: volunteerAssignments.period,
          volunteerType: volunteerAssignments.volunteerType,
          status: volunteerAssignments.status,
          guardian: {
            id: guardians.id,
            firstName: guardians.firstName,
            lastName: guardians.lastName
          },
          scheduleId: volunteerAssignments.scheduleId,
          volunteerJobId: volunteerAssignments.volunteerJobId,
           className: classTeachingRequests.className,
           teacherName: classTeachingRequests.teacherName,
           classroom: sessionClassrooms.name,
          jobTitle: volunteerJobs.title
        })
        .from(volunteerAssignments)
        .leftJoin(guardians, eq(volunteerAssignments.guardianId, guardians.id))
        .leftJoin(schedules, eq(volunteerAssignments.scheduleId, schedules.id))
        .leftJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
        .leftJoin(sessionClassrooms, eq(schedules.sessionClassroomId, sessionClassrooms.id))
        .leftJoin(volunteerJobs, eq(volunteerAssignments.volunteerJobId, volunteerJobs.id))
        .where(eq(volunteerAssignments.sessionId, sessionId)),

      db
        .select({
          id: volunteerJobs.id,
          title: volunteerJobs.title,
          jobType: volunteerJobs.jobType,
          quantityAvailable: sessionVolunteerJobs.quantityAvailable
        })
        .from(sessionVolunteerJobs)
        .innerJoin(volunteerJobs, eq(sessionVolunteerJobs.volunteerJobId, volunteerJobs.id))
        .where(and(
          eq(sessionVolunteerJobs.sessionId, sessionId),
          eq(sessionVolunteerJobs.isActive, true)
        )),

      db
        .select({
          id: guardians.id,
          firstName: guardians.firstName,
          lastName: guardians.lastName,
          email: guardians.email
        })
        .from(guardians),

      db
        .select({
          id: children.id,
          firstName: children.firstName,
          lastName: children.lastName,
          grade: children.grade,
          familyId: children.familyId
        })
        .from(children),

      db
        .select({
          id: sessionClassrooms.id,
          name: sessionClassrooms.name,
          classroomId: sessionClassrooms.classroomId
        })
        .from(sessionClassrooms)
        .where(eq(sessionClassrooms.sessionId, sessionId))
    ])

    const registrationCountMap = registrationRows.reduce((acc, row) => {
      acc[row.schedule.id] = (acc[row.schedule.id] || 0) + (row.status === 'registered' ? 1 : 0)
      return acc
    }, {} as Record<string, number>)

    const schedulesResponse = scheduleRows.map((row) => ({
      id: row.id,
      classroomId: row.classroomId,
      period: row.period,
      className: row.className,
      classroom: row.classroom,
       teacher: row.teacherName || `${row.teacherFirstName} ${row.teacherLastName}`,
      maxStudents: row.maxStudents,
      currentRegistrations: registrationCountMap[row.id] || 0
    }))

    const volunteerAssignmentsResponse = volunteerRows.map((row) => ({
      id: row.id,
      period: row.period,
      volunteerType: row.volunteerType,
      status: row.status,
      guardian: row.guardian,
      schedule: row.scheduleId
        ? {
            id: row.scheduleId,
            period: row.period,
            className: row.className || 'Class',
            classroom: row.classroom || 'Room',
             teacher: row.className ? (row.teacherName || 'Teacher') : 'Teacher'
          }
        : null,
      volunteerJob: row.volunteerJobId
        ? {
            id: row.volunteerJobId,
            title: row.jobTitle || 'Volunteer Job'
          }
        : null
    }))

    return NextResponse.json({
      registrations: registrationRows,
      schedules: schedulesResponse,
      volunteerAssignments: volunteerAssignmentsResponse,
      volunteerJobs: volunteerJobRows,
      guardians: guardianRows,
      children: childRows,
      classrooms: classroomRows
    })
  } catch (error) {
    console.error('Error loading admin registrations:', error)
    return NextResponse.json({ error: 'Failed to load registrations' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedAdmin('registrations')
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { session } = auth
    const body = await request.json()
    const { sessionId, scheduleId, childId, status = 'registered' } = body

    if (!sessionId || !scheduleId || !childId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const child = await db
      .select({ id: children.id, familyId: children.familyId })
      .from(children)
      .where(eq(children.id, childId))
      .limit(1)

    if (!child.length) {
      return NextResponse.json({ error: 'Child not found' }, { status: 404 })
    }

    const scheduleData = await db
      .select({
        schedule: schedules,
        classTeachingRequest: classTeachingRequests
      })
      .from(schedules)
      .innerJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
      .where(eq(schedules.id, scheduleId))
      .limit(1)

    if (!scheduleData.length) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    if (status === 'registered') {
      const currentCount = await db
        .select()
        .from(classRegistrations)
        .where(and(
          eq(classRegistrations.scheduleId, scheduleId),
          eq(classRegistrations.status, 'registered')
        ))

      if (currentCount.length >= scheduleData[0].classTeachingRequest.maxStudents) {
        return NextResponse.json({ error: 'Target class is full' }, { status: 400 })
      }

      const existingRegistration = await db
        .select()
        .from(classRegistrations)
        .innerJoin(schedules, eq(classRegistrations.scheduleId, schedules.id))
        .where(and(
          eq(classRegistrations.childId, childId),
          eq(classRegistrations.sessionId, sessionId),
          eq(schedules.period, scheduleData[0].schedule.period),
          eq(classRegistrations.status, 'registered')
        ))
        .limit(1)

      if (existingRegistration.length) {
        return NextResponse.json({ error: 'Child already registered for this period' }, { status: 400 })
      }
    }

    const inserted = await db
      .insert(classRegistrations)
      .values({
        id: randomUUID(),
        sessionId,
        scheduleId,
        childId,
        familyId: child[0].familyId,
        registeredBy: session.user.id,
        status
      })
      .returning()

    publishRegistrationUpdate(sessionId)
    return NextResponse.json({ registration: inserted[0] })
  } catch (error) {
    console.error('Error creating registration:', error)
    return NextResponse.json({ error: 'Failed to create registration' }, { status: 500 })
  }
}
