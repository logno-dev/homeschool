import { and, asc, eq, gt, inArray, isNull, or, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { classRegistrations, classTeachingRequests, schedules, waitlistVacancyFlags } from '@/lib/schema'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { publishRegistrationUpdate } from '@/lib/registration-events'
import { getStudentTeacherAssignment } from '@/lib/student-teachers'
import { refreshRegistrationFees } from '@/lib/fee-calculation'
import { syncClassCharges } from '@/lib/class-fee-ledger'
import { createWaitlistVacancyFlag } from '@/lib/waitlist'

type UpdateFailure = { error: string; status: number; code?: string; currentRegistrations?: number; maxStudents?: number }

export async function PATCH(request: Request, { params }: { params: Promise<{ registrationId: string }> }) {
  try {
    const auth = await getAuthenticatedAdmin('registrations')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const { registrationId } = await params
    const body = await request.json()
    const scheduleId = typeof body.scheduleId === 'string' ? body.scheduleId : ''
    const status = typeof body.status === 'string' ? body.status : ''
    const allowOverload = body.allowOverload === true
    const allowWaitlistOverride = body.allowWaitlistOverride === true
    if (!scheduleId && !status) return NextResponse.json({ error: 'No updates provided' }, { status: 400 })

    const [current] = await db.select().from(classRegistrations).where(eq(classRegistrations.id, registrationId)).limit(1)
    if (!current) return NextResponse.json({ error: 'Registration not found' }, { status: 404 })
    const targetScheduleId = scheduleId || current.scheduleId
    const [target] = await db.select({ schedule: schedules, classRequest: classTeachingRequests }).from(schedules)
      .innerJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
      .where(eq(schedules.id, targetScheduleId)).limit(1)
    if (!target) return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })

    if (scheduleId || status === 'registered') {
      const studentTeacherAssignment = await getStudentTeacherAssignment(current.sessionId, current.childId, target.schedule.period)
      if (studentTeacherAssignment) return NextResponse.json({ error: `Child is the student teacher for ${studentTeacherAssignment.className} during this period` }, { status: 400 })
    }

    if (status === 'registered' && current.status === 'waitlisted' && !scheduleId) {
      const result = await db.transaction(async (tx): Promise<{ registration?: typeof current; swappedFromScheduleId?: string; vacancyFlag?: { id: string; openSlots: number; waitlistCount: number } | null; failure?: UpdateFailure }> => {
        const [waitlisted] = await tx.select().from(classRegistrations).where(eq(classRegistrations.id, registrationId)).limit(1)
        if (!waitlisted || waitlisted.status !== 'waitlisted') return { failure: { error: 'This student is no longer waitlisted.', status: 409 } }
        const [first] = await tx.select({ id: classRegistrations.id }).from(classRegistrations).where(and(eq(classRegistrations.scheduleId, waitlisted.scheduleId), eq(classRegistrations.status, 'waitlisted'))).orderBy(sql`${classRegistrations.waitlistRank} IS NULL`, asc(classRegistrations.waitlistRank), asc(classRegistrations.registeredAt), asc(classRegistrations.id)).limit(1)
        if (first?.id !== waitlisted.id && !allowWaitlistOverride) return { failure: { error: 'This student is not first on the waitlist. Confirm an order override to promote them.', status: 409, code: 'WAITLIST_ORDER' } }

        const now = new Date().toISOString()
        const occupied = await tx.select({ id: classRegistrations.id }).from(classRegistrations).where(and(eq(classRegistrations.scheduleId, waitlisted.scheduleId), or(inArray(classRegistrations.status, ['registered', 'pending']), and(eq(classRegistrations.status, 'hold'), gt(classRegistrations.holdExpiresAt, now)))))
        if (!allowOverload && occupied.length >= target.classRequest.maxStudents) return { failure: { error: 'Target class is full', status: 409, code: 'CLASS_FULL', currentRegistrations: occupied.length, maxStudents: target.classRequest.maxStudents } }

        const samePeriod = await tx.select({ id: classRegistrations.id, scheduleId: classRegistrations.scheduleId, status: classRegistrations.status }).from(classRegistrations)
          .innerJoin(schedules, eq(classRegistrations.scheduleId, schedules.id))
          .where(and(eq(classRegistrations.childId, waitlisted.childId), eq(classRegistrations.sessionId, waitlisted.sessionId), eq(schedules.period, target.schedule.period), or(inArray(classRegistrations.status, ['registered', 'pending']), and(eq(classRegistrations.status, 'hold'), or(isNull(classRegistrations.holdExpiresAt), gt(classRegistrations.holdExpiresAt, now))))))
        const blocking = samePeriod.find((entry) => entry.status !== 'registered')
        if (blocking) return { failure: { error: 'This child has a pending registration or active hold in the same period. Resolve it before promotion.', status: 409, code: 'PERIOD_CONFLICT' } }

        await syncClassCharges(waitlisted.sessionId, waitlisted.familyId, tx)
        const registeredSources = samePeriod.filter((entry) => entry.status === 'registered' && entry.scheduleId !== waitlisted.scheduleId)
        if (registeredSources.length) await tx.update(classRegistrations).set({ status: 'cancelled', updatedAt: now }).where(inArray(classRegistrations.id, registeredSources.map((entry) => entry.id)))
        const [promoted] = await tx.update(classRegistrations).set({ status: 'registered', holdExpiresAt: null, updatedAt: now }).where(eq(classRegistrations.id, waitlisted.id)).returning()
        await tx.update(waitlistVacancyFlags).set({ status: 'resolved', resolutionNotes: 'Resolved by waitlist promotion', resolvedBy: auth.session.user.id, resolvedAt: now, updatedAt: now }).where(and(eq(waitlistVacancyFlags.scheduleId, waitlisted.scheduleId), eq(waitlistVacancyFlags.status, 'open')))
        await refreshRegistrationFees(waitlisted.sessionId, waitlisted.familyId, tx)

        let vacancyFlag = null
        for (const source of registeredSources) vacancyFlag = (await createWaitlistVacancyFlag(tx, source.scheduleId, promoted.id, auth.session.user.id)) || vacancyFlag
        return { registration: promoted, swappedFromScheduleId: registeredSources[0]?.scheduleId, vacancyFlag }
      })
      if (result.failure) return NextResponse.json({ error: result.failure.error, code: result.failure.code, currentRegistrations: result.failure.currentRegistrations, maxStudents: result.failure.maxStudents }, { status: result.failure.status })
      publishRegistrationUpdate(current.sessionId)
      return NextResponse.json({ registration: result.registration, swappedFromScheduleId: result.swappedFromScheduleId || null, vacancyFlag: result.vacancyFlag || null })
    }

    const result = await db.transaction(async (tx): Promise<{ registration?: typeof current; vacancyFlag?: { id: string; openSlots: number; waitlistCount: number } | null; failure?: UpdateFailure }> => {
      const [previous] = await tx.select().from(classRegistrations).where(eq(classRegistrations.id, registrationId)).limit(1)
      if (!previous) return { failure: { error: 'Registration not found', status: 404 } }
      if (scheduleId || status === 'registered') {
        const now = new Date().toISOString()
        const occupied = await tx.select({ id: classRegistrations.id }).from(classRegistrations).where(and(eq(classRegistrations.scheduleId, targetScheduleId), or(inArray(classRegistrations.status, ['registered', 'pending']), and(eq(classRegistrations.status, 'hold'), gt(classRegistrations.holdExpiresAt, now)))))
        const occupiedCount = occupied.filter((entry) => entry.id !== registrationId).length
        if (!allowOverload && occupiedCount >= target.classRequest.maxStudents) return { failure: { error: 'Target class is full', status: 409, code: 'CLASS_FULL', currentRegistrations: occupiedCount, maxStudents: target.classRequest.maxStudents } }
      }
      await syncClassCharges(previous.sessionId, previous.familyId, tx)
      const [updated] = await tx.update(classRegistrations).set({ ...(scheduleId ? { scheduleId, status: 'registered', holdExpiresAt: null } : status ? { status, ...(status === 'registered' ? { holdExpiresAt: null } : {}) } : {}), updatedAt: new Date().toISOString() }).where(eq(classRegistrations.id, registrationId)).returning()
      await refreshRegistrationFees(previous.sessionId, previous.familyId, tx)
      const vacatedScheduleId = previous.status === 'registered' && ((scheduleId && scheduleId !== previous.scheduleId) || status === 'cancelled') ? previous.scheduleId : null
      const vacancyFlag = vacatedScheduleId ? await createWaitlistVacancyFlag(tx, vacatedScheduleId, updated.id, auth.session.user.id) : null
      return { registration: updated, vacancyFlag }
    })
    if (result.failure) return NextResponse.json({ error: result.failure.error, code: result.failure.code, currentRegistrations: result.failure.currentRegistrations, maxStudents: result.failure.maxStudents }, { status: result.failure.status })
    publishRegistrationUpdate(current.sessionId)
    return NextResponse.json({ registration: result.registration, vacancyFlag: result.vacancyFlag || null })
  } catch (error) {
    console.error('Error updating registration:', error)
    return NextResponse.json({ error: 'Failed to update registration' }, { status: 500 })
  }
}
