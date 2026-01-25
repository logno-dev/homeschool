import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { and, eq, or, gt, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { getGuardianById } from '@/lib/database'
import { volunteerAssignments, schedules, classTeachingRequests, sessionVolunteerJobs, guardians } from '@/lib/schema'
import { publishRegistrationUpdate } from '@/lib/registration-events'

const HOLD_DURATION_MS = 24 * 60 * 60 * 1000

const normalizePeriod = (period: string) => {
  switch (period) {
    case '1':
    case 'first':
      return 'first'
    case '2':
    case 'second':
      return 'second'
    case '3':
    case 'third':
      return 'third'
    case 'lunch':
      return 'lunch'
    case 'non_period':
      return 'non_period'
    default:
      return period
  }
}

export async function POST(request: Request) {
  try {
    const session = await getAuthenticatedUser()
    const guardian = await getGuardianById(session.user.id)

    if (!guardian?.familyId) {
      return NextResponse.json({ error: 'Guardian not found' }, { status: 404 })
    }

    const { sessionId, guardianId, period, volunteerType, scheduleId, volunteerJobId } = await request.json()

    if (!sessionId || !guardianId || !period || !volunteerType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const guardianRecord = await db
      .select({ id: guardians.id, familyId: guardians.familyId })
      .from(guardians)
      .where(eq(guardians.id, guardianId))
      .limit(1)

    if (!guardianRecord.length || guardianRecord[0].familyId !== guardian.familyId) {
      return NextResponse.json({ error: 'Guardian mismatch' }, { status: 403 })
    }

    if (volunteerType === 'volunteer_job' && !volunteerJobId) {
      return NextResponse.json({ error: 'Missing volunteer job id' }, { status: 400 })
    }

    if (volunteerType !== 'volunteer_job' && !scheduleId) {
      return NextResponse.json({ error: 'Missing schedule id' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const normalizedPeriod = normalizePeriod(period)

    const existingHold = await db
      .select({ id: volunteerAssignments.id, holdExpiresAt: volunteerAssignments.holdExpiresAt })
      .from(volunteerAssignments)
      .where(and(
        eq(volunteerAssignments.sessionId, sessionId),
        eq(volunteerAssignments.familyId, guardian.familyId),
        eq(volunteerAssignments.guardianId, guardianId),
        eq(volunteerAssignments.period, normalizedPeriod),
        eq(volunteerAssignments.status, 'hold'),
        gt(volunteerAssignments.holdExpiresAt, now)
      ))
      .limit(1)

    if (existingHold.length) {
      return NextResponse.json({
        holdCreated: true,
        holdId: existingHold[0].id,
        holdExpiresAt: existingHold[0].holdExpiresAt
      })
    }

    const existingAssignment = await db
      .select({ id: volunteerAssignments.id })
      .from(volunteerAssignments)
      .where(and(
        eq(volunteerAssignments.guardianId, guardianId),
        eq(volunteerAssignments.sessionId, sessionId),
        inArray(volunteerAssignments.status, ['assigned', 'pending']),
        eq(volunteerAssignments.period, normalizedPeriod)
      ))
      .limit(1)

    if (existingAssignment.length) {
      return NextResponse.json({ error: 'Guardian already assigned for this period' }, { status: 409 })
    }

    if (scheduleId && volunteerType === 'helper') {
      const scheduleData = await db
        .select({ classTeachingRequest: classTeachingRequests })
        .from(schedules)
        .innerJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
        .where(eq(schedules.id, scheduleId))
        .limit(1)

      if (!scheduleData.length) {
        return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
      }

      const currentHelpers = await db
        .select({ id: volunteerAssignments.id })
        .from(volunteerAssignments)
        .where(and(
          eq(volunteerAssignments.scheduleId, scheduleId),
          eq(volunteerAssignments.volunteerType, 'helper'),
          or(
            inArray(volunteerAssignments.status, ['assigned', 'pending']),
            and(eq(volunteerAssignments.status, 'hold'), gt(volunteerAssignments.holdExpiresAt, now))
          )
        ))

      if (currentHelpers.length >= scheduleData[0].classTeachingRequest.helpersNeeded) {
        return NextResponse.json({ error: 'No helper spots available' }, { status: 409 })
      }
    }

    if (volunteerJobId && volunteerType === 'volunteer_job') {
      const sessionJob = await db
        .select({ quantityAvailable: sessionVolunteerJobs.quantityAvailable })
        .from(sessionVolunteerJobs)
        .where(and(
          eq(sessionVolunteerJobs.sessionId, sessionId),
          eq(sessionVolunteerJobs.volunteerJobId, volunteerJobId)
        ))
        .limit(1)

      if (!sessionJob.length) {
        return NextResponse.json({ error: 'Volunteer job not found' }, { status: 404 })
      }

      const currentAssignments = await db
        .select({ id: volunteerAssignments.id })
        .from(volunteerAssignments)
        .where(and(
          eq(volunteerAssignments.sessionId, sessionId),
          eq(volunteerAssignments.volunteerJobId, volunteerJobId),
          or(
            inArray(volunteerAssignments.status, ['assigned', 'pending']),
            and(eq(volunteerAssignments.status, 'hold'), gt(volunteerAssignments.holdExpiresAt, now))
          )
        ))

      if (currentAssignments.length >= sessionJob[0].quantityAvailable) {
        return NextResponse.json({ error: 'Volunteer job is full' }, { status: 409 })
      }
    }

    const holdId = randomUUID()
    const holdExpiresAt = new Date(Date.now() + HOLD_DURATION_MS).toISOString()

    await db.insert(volunteerAssignments).values({
      id: holdId,
      sessionId,
      guardianId,
      familyId: guardian.familyId,
      period: normalizedPeriod,
      volunteerType,
      scheduleId: scheduleId || null,
      volunteerJobId: volunteerJobId || null,
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
    console.error('Error creating volunteer hold:', error)
    return NextResponse.json({ error: 'Failed to create hold' }, { status: 500 })
  }
}
