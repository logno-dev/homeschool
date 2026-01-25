import { NextResponse } from 'next/server'
import { and, eq, gt } from 'drizzle-orm'
import { db } from '@/lib/db'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { getGuardianById } from '@/lib/database'
import { classRegistrations, volunteerAssignments } from '@/lib/schema'

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

    await db
      .update(classRegistrations)
      .set({ holdExpiresAt, updatedAt: new Date().toISOString() })
      .where(and(
        eq(classRegistrations.sessionId, sessionId),
        eq(classRegistrations.familyId, guardian.familyId),
        eq(classRegistrations.status, 'hold'),
        gt(classRegistrations.holdExpiresAt, now)
      ))

    await db
      .update(volunteerAssignments)
      .set({ holdExpiresAt, updatedAt: new Date().toISOString() })
      .where(and(
        eq(volunteerAssignments.sessionId, sessionId),
        eq(volunteerAssignments.familyId, guardian.familyId),
        eq(volunteerAssignments.status, 'hold'),
        gt(volunteerAssignments.holdExpiresAt, now)
      ))

    return NextResponse.json({ success: true, holdExpiresAt })
  } catch (error) {
    console.error('Error refreshing holds:', error)
    return NextResponse.json({ error: 'Failed to refresh holds' }, { status: 500 })
  }
}
