import { NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { volunteerAssignments, schedules } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { getGuardianById } from '@/lib/database'

export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json()
    const { sessionId, guardianId, period, volunteerType, scheduleId, volunteerJobId } = body

    if (!sessionId || !guardianId || !volunteerType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const guardian = await getGuardianById(guardianId)
    if (!guardian?.familyId) {
      return NextResponse.json({ error: 'Guardian family not found' }, { status: 400 })
    }

    let finalPeriod = period
    if (volunteerType !== 'volunteer_job') {
      if (!scheduleId) {
        return NextResponse.json({ error: 'scheduleId is required for class-based assignments' }, { status: 400 })
      }
      const schedule = await db.select().from(schedules).where(eq(schedules.id, scheduleId)).limit(1)
      if (!schedule.length) {
        return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
      }
      finalPeriod = schedule[0].period
    } else if (!volunteerJobId) {
      return NextResponse.json({ error: 'volunteerJobId is required for volunteer jobs' }, { status: 400 })
    }

    const inserted = await db
      .insert(volunteerAssignments)
      .values({
        id: randomUUID(),
        sessionId,
        guardianId,
        familyId: guardian.familyId,
        period: finalPeriod,
        volunteerType,
        scheduleId: volunteerType === 'volunteer_job' ? null : scheduleId,
        volunteerJobId: volunteerType === 'volunteer_job' ? volunteerJobId : null,
        status: 'assigned'
      })
      .returning()

    return NextResponse.json({ assignment: inserted[0] })
  } catch (error) {
    console.error('Error creating volunteer assignment:', error)
    return NextResponse.json({ error: 'Failed to create assignment' }, { status: 500 })
  }
}
