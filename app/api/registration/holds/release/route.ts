import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { getGuardianById } from '@/lib/database'
import { classRegistrations, volunteerAssignments } from '@/lib/schema'
import { publishRegistrationUpdate } from '@/lib/registration-events'

export async function POST(request: Request) {
  try {
    const session = await getAuthenticatedUser()
    const guardian = await getGuardianById(session.user.id)

    if (!guardian?.familyId) {
      return NextResponse.json({ error: 'Guardian not found' }, { status: 404 })
    }

    const { holdId, holdType } = await request.json()

    if (!holdId || !holdType) {
      return NextResponse.json({ error: 'Missing hold id or type' }, { status: 400 })
    }

    let sessionId: string | null = null

    if (holdType === 'class') {
      const existing = await db
        .select({ id: classRegistrations.id, sessionId: classRegistrations.sessionId })
        .from(classRegistrations)
        .where(and(
          eq(classRegistrations.id, holdId),
          eq(classRegistrations.familyId, guardian.familyId),
          eq(classRegistrations.status, 'hold')
        ))
        .limit(1)

      if (existing.length) {
        sessionId = existing[0].sessionId
        await db
          .delete(classRegistrations)
          .where(eq(classRegistrations.id, holdId))
      }
    }

    if (holdType === 'volunteer') {
      const existing = await db
        .select({ id: volunteerAssignments.id, sessionId: volunteerAssignments.sessionId })
        .from(volunteerAssignments)
        .where(and(
          eq(volunteerAssignments.id, holdId),
          eq(volunteerAssignments.familyId, guardian.familyId),
          eq(volunteerAssignments.status, 'hold')
        ))
        .limit(1)

      if (existing.length) {
        sessionId = existing[0].sessionId
        await db
          .delete(volunteerAssignments)
          .where(eq(volunteerAssignments.id, holdId))
      }
    }

    if (sessionId) {
      publishRegistrationUpdate(sessionId)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error releasing hold:', error)
    return NextResponse.json({ error: 'Failed to release hold' }, { status: 500 })
  }
}
