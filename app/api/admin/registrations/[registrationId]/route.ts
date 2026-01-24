import { NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { classRegistrations, schedules, classTeachingRequests } from '@/lib/schema'
import { and, eq } from 'drizzle-orm'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ registrationId: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin()
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
        .select({ scheduleId: classRegistrations.scheduleId })
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

      const { classTeachingRequest } = scheduleData[0]
      const currentCount = await db
        .select()
        .from(classRegistrations)
        .where(and(
          eq(classRegistrations.scheduleId, targetScheduleId),
          eq(classRegistrations.status, 'registered')
        ))

      if (currentCount.length >= classTeachingRequest.maxStudents) {
        return NextResponse.json({ error: 'Target class is full' }, { status: 400 })
      }
    }

    const updated = await db
      .update(classRegistrations)
      .set({
        ...(scheduleId ? { scheduleId } : {}),
        ...(status ? { status } : {}),
        updatedAt: new Date().toISOString()
      })
      .where(eq(classRegistrations.id, registrationId))
      .returning()

    if (!updated.length) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 })
    }

    return NextResponse.json({ registration: updated[0] })
  } catch (error) {
    console.error('Error updating registration:', error)
    return NextResponse.json({ error: 'Failed to update registration' }, { status: 500 })
  }
}
