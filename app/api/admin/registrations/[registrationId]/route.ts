import { NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { classRegistrations, schedules, classTeachingRequests } from '@/lib/schema'
import { and, eq, or, inArray, gt } from 'drizzle-orm'
import { publishRegistrationUpdate } from '@/lib/registration-events'
import { getStudentTeacherAssignment } from '@/lib/student-teachers'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ registrationId: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin('registrations')
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { registrationId } = await params
    const body = await request.json()
    const { scheduleId, status } = body

    if (!scheduleId && !status) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }

    if (scheduleId || status === 'registered') {
      const registration = await db
        .select({ scheduleId: classRegistrations.scheduleId, childId: classRegistrations.childId, sessionId: classRegistrations.sessionId })
        .from(classRegistrations)
        .where(eq(classRegistrations.id, registrationId))
        .limit(1)

      const targetScheduleId = scheduleId || registration[0]?.scheduleId
      if (!targetScheduleId) {
        return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
      }

      const scheduleData = await db
        .select({
          schedule: schedules,
          classTeachingRequest: classTeachingRequests
        })
        .from(schedules)
        .innerJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
        .where(eq(schedules.id, targetScheduleId))
        .limit(1)

      if (!scheduleData.length) {
        return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
      }

      const studentTeacherAssignment = registration[0] ? await getStudentTeacherAssignment(registration[0].sessionId, registration[0].childId, scheduleData[0].schedule.period) : null
      if (studentTeacherAssignment) return NextResponse.json({ error: `Child is the student teacher for ${studentTeacherAssignment.className} during this period` }, { status: 400 })

      const { classTeachingRequest } = scheduleData[0]
      const currentCount = await db
        .select({ id: classRegistrations.id, status: classRegistrations.status, holdExpiresAt: classRegistrations.holdExpiresAt })
        .from(classRegistrations)
        .where(and(
          eq(classRegistrations.scheduleId, targetScheduleId),
          or(
            inArray(classRegistrations.status, ['registered', 'pending']),
            and(eq(classRegistrations.status, 'hold'), gt(classRegistrations.holdExpiresAt, new Date().toISOString()))
          )
        ))

      const occupiedCount = currentCount.filter((entry) => entry.id !== registrationId).length
      if (occupiedCount >= classTeachingRequest.maxStudents && (status === 'registered' || Boolean(scheduleId))) {
        return NextResponse.json({ error: 'Target class is full' }, { status: 400 })
      }
    }

    const updated = await db
      .update(classRegistrations)
      .set({
        ...(scheduleId ? { scheduleId } : {}),
        ...(scheduleId ? { status: 'registered', holdExpiresAt: null } : status ? { status, ...(status === 'registered' ? { holdExpiresAt: null } : {}) } : {}),
        updatedAt: new Date().toISOString()
      })
      .where(eq(classRegistrations.id, registrationId))
      .returning()

    if (!updated.length) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 })
    }

    publishRegistrationUpdate(updated[0].sessionId)
    return NextResponse.json({ registration: updated[0] })
  } catch (error) {
    console.error('Error updating registration:', error)
    return NextResponse.json({ error: 'Failed to update registration' }, { status: 500 })
  }
}
