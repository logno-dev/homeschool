import { NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import {
  classrooms,
  schedules,
  classTeachingRequests,
  guardians,
  classRegistrations,
  children,
  families
} from '@/lib/schema'
import { and, eq } from 'drizzle-orm'
import { getSessionById } from '@/lib/database'

export async function GET(request: Request) {
  try {
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const url = new URL(request.url)
    const sessionId = url.searchParams.get('sessionId')
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
    }

    const session = await getSessionById(sessionId)
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const [classroomRows, scheduleRows, rosterRows, familyRows, guardianRows, childRows] = await Promise.all([
      db.select().from(classrooms),
      db
        .select({
          scheduleId: schedules.id,
          classroomId: classrooms.id,
          classroomName: classrooms.name,
          period: schedules.period,
          className: classTeachingRequests.className,
          teacherFirstName: guardians.firstName,
          teacherLastName: guardians.lastName
        })
        .from(schedules)
        .innerJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
        .innerJoin(classrooms, eq(schedules.classroomId, classrooms.id))
        .innerJoin(guardians, eq(classTeachingRequests.guardianId, guardians.id))
        .where(and(
          eq(schedules.sessionId, sessionId),
          eq(schedules.status, 'published')
        )),
      db
        .select({
          scheduleId: classRegistrations.scheduleId,
          status: classRegistrations.status,
          child: {
            id: children.id,
            firstName: children.firstName,
            lastName: children.lastName,
            grade: children.grade
          }
        })
        .from(classRegistrations)
        .innerJoin(children, eq(classRegistrations.childId, children.id))
        .where(and(
          eq(classRegistrations.sessionId, sessionId),
          eq(classRegistrations.status, 'registered')
        )),
      db.select().from(families),
      db.select().from(guardians),
      db.select().from(children)
    ])

    return NextResponse.json({
      session,
      classrooms: classroomRows,
      schedules: scheduleRows,
      roster: rosterRows,
      families: familyRows,
      guardians: guardianRows,
      children: childRows
    })
  } catch (error) {
    console.error('Error loading reports:', error)
    return NextResponse.json({ error: 'Failed to load reports' }, { status: 500 })
  }
}
