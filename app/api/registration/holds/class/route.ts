import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { and, eq, or, gt, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { getGuardianById } from '@/lib/database'
import { classRegistrations, schedules, children, classTeachingRequests } from '@/lib/schema'
import { publishRegistrationUpdate } from '@/lib/registration-events'

const HOLD_DURATION_MS = 24 * 60 * 60 * 1000

export async function POST(request: Request) {
  try {
    const session = await getAuthenticatedUser()
    const guardian = await getGuardianById(session.user.id)

    if (!guardian?.familyId) {
      return NextResponse.json({ error: 'Guardian not found' }, { status: 404 })
    }

    const { sessionId, scheduleId, childId, status } = await request.json()

    if (!sessionId || !scheduleId || !childId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (status === 'waitlisted') {
      return NextResponse.json({ holdCreated: false })
    }

    const now = new Date().toISOString()

    const childRecord = await db
      .select({ id: children.id })
      .from(children)
      .where(and(eq(children.id, childId), eq(children.familyId, guardian.familyId)))
      .limit(1)

    if (!childRecord.length) {
      return NextResponse.json({ error: 'Child not found for this family' }, { status: 404 })
    }

    const scheduleRecord = await db
      .select({
        schedule: schedules,
        classTeachingRequest: classTeachingRequests
      })
      .from(schedules)
      .innerJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
      .where(and(eq(schedules.id, scheduleId), eq(schedules.sessionId, sessionId)))
      .limit(1)

    if (!scheduleRecord.length) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    const existingHold = await db
      .select({ id: classRegistrations.id, holdExpiresAt: classRegistrations.holdExpiresAt })
      .from(classRegistrations)
      .where(and(
        eq(classRegistrations.sessionId, sessionId),
        eq(classRegistrations.familyId, guardian.familyId),
        eq(classRegistrations.childId, childId),
        eq(classRegistrations.scheduleId, scheduleId),
        eq(classRegistrations.status, 'hold'),
        gt(classRegistrations.holdExpiresAt, now)
      ))
      .limit(1)

    if (existingHold.length) {
      return NextResponse.json({
        holdCreated: true,
        holdId: existingHold[0].id,
        holdExpiresAt: existingHold[0].holdExpiresAt
      })
    }

    const existingRegistration = await db
      .select({ status: classRegistrations.status })
      .from(classRegistrations)
      .innerJoin(schedules, eq(classRegistrations.scheduleId, schedules.id))
      .where(and(
        eq(classRegistrations.childId, childId),
        eq(classRegistrations.sessionId, sessionId),
        inArray(classRegistrations.status, ['registered', 'pending']),
        eq(schedules.period, scheduleRecord[0].schedule.period)
      ))
      .limit(1)

    if (existingRegistration.length) {
      return NextResponse.json({ error: 'Child already registered for this period' }, { status: 409 })
    }

    const currentRegistrations = await db
      .select({ id: classRegistrations.id })
      .from(classRegistrations)
      .where(and(
        eq(classRegistrations.scheduleId, scheduleId),
        eq(classRegistrations.sessionId, sessionId),
        or(
          inArray(classRegistrations.status, ['registered', 'pending']),
          and(eq(classRegistrations.status, 'hold'), gt(classRegistrations.holdExpiresAt, now))
        )
      ))

    if (currentRegistrations.length >= scheduleRecord[0].classTeachingRequest.maxStudents) {
      return NextResponse.json({ error: 'Class is full' }, { status: 409 })
    }

    const holdId = randomUUID()
    const holdExpiresAt = new Date(Date.now() + HOLD_DURATION_MS).toISOString()

    await db.insert(classRegistrations).values({
      id: holdId,
      sessionId,
      scheduleId,
      childId,
      familyId: guardian.familyId,
      registeredBy: session.user.id,
      status: 'hold',
      holdExpiresAt
    })

    publishRegistrationUpdate(sessionId)

    return NextResponse.json({
      holdCreated: true,
      holdId,
      holdExpiresAt
    })
  } catch (error) {
    console.error('Error creating class hold:', error)
    return NextResponse.json({ error: 'Failed to create hold' }, { status: 500 })
  }
}
