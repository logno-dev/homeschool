import { NextResponse } from 'next/server'
import { and, eq, gt, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { getGuardianById } from '@/lib/database'
import { classRegistrations, volunteerAssignments } from '@/lib/schema'
import { getVisibleVolunteerJobs } from '@/lib/volunteer-job-access'

const HOLD_DURATION_MS = 24 * 60 * 60 * 1000

export async function POST(request: Request) {
  try {
    const session = await getAuthenticatedUser()
    const guardian = await getGuardianById(session.user.id)

    if (!guardian?.familyId) {
      return NextResponse.json({ error: 'Guardian not found' }, { status: 404 })
    }

    const { sessionId } = await request.json()

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const holdExpiresAt = new Date(Date.now() + HOLD_DURATION_MS).toISOString()

    const visibleJobs = await getVisibleVolunteerJobs(session.user.id)
    const volunteerHolds = await db.select().from(volunteerAssignments).where(and(
      eq(volunteerAssignments.sessionId, sessionId), eq(volunteerAssignments.familyId, guardian.familyId),
      eq(volunteerAssignments.status, 'hold'), gt(volunteerAssignments.holdExpiresAt, now)
    ))
    const renewableIds = volunteerHolds.filter(hold => !hold.volunteerJobId || visibleJobs.get(hold.volunteerJobId)?.includes(hold.guardianId)).map(hold => hold.id)

    await db
      .update(classRegistrations)
      .set({ holdExpiresAt, updatedAt: new Date().toISOString() })
      .where(and(
        eq(classRegistrations.sessionId, sessionId),
        eq(classRegistrations.familyId, guardian.familyId),
        eq(classRegistrations.status, 'hold'),
        gt(classRegistrations.holdExpiresAt, now)
      ))

    if (renewableIds.length) await db
      .update(volunteerAssignments)
      .set({ holdExpiresAt, updatedAt: new Date().toISOString() })
      .where(and(
        eq(volunteerAssignments.sessionId, sessionId),
        eq(volunteerAssignments.familyId, guardian.familyId),
        inArray(volunteerAssignments.id, renewableIds),
        eq(volunteerAssignments.status, 'hold'),
        gt(volunteerAssignments.holdExpiresAt, now)
      ))

    return NextResponse.json({ success: true, holdExpiresAt })
  } catch (error) {
    console.error('Error refreshing holds:', error)
    return NextResponse.json({ error: 'Failed to refresh holds' }, { status: 500 })
  }
}
