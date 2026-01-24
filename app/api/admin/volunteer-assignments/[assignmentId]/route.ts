import { NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { volunteerAssignments, schedules } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { getGuardianById } from '@/lib/database'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { assignmentId } = await params
    const body = await request.json()
    const { guardianId, period, volunteerType, scheduleId, volunteerJobId, status } = body

    if (!guardianId || !volunteerType) {
      if (!status) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
      }
    }

    const guardian = guardianId ? await getGuardianById(guardianId) : null
    if (guardianId && !guardian?.familyId) {
      return NextResponse.json({ error: 'Guardian family not found' }, { status: 400 })
    }

    let finalPeriod = period
    if (volunteerType && volunteerType !== 'volunteer_job') {
      if (!scheduleId) {
        return NextResponse.json({ error: 'scheduleId is required for class-based assignments' }, { status: 400 })
      }
      const schedule = await db.select().from(schedules).where(eq(schedules.id, scheduleId)).limit(1)
      if (!schedule.length) {
        return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
      }
      finalPeriod = schedule[0].period
    } else if (volunteerType === 'volunteer_job' && !volunteerJobId) {
      return NextResponse.json({ error: 'volunteerJobId is required for volunteer jobs' }, { status: 400 })
    }

    const updatePayload = {
      ...(guardianId ? { guardianId } : {}),
      ...(guardian?.familyId ? { familyId: guardian.familyId } : {}),
      ...(finalPeriod ? { period: finalPeriod } : {}),
      ...(volunteerType ? { volunteerType } : {}),
      ...(scheduleId !== undefined && volunteerType ? { scheduleId: volunteerType === 'volunteer_job' ? null : scheduleId } : {}),
      ...(volunteerJobId !== undefined && volunteerType ? { volunteerJobId: volunteerType === 'volunteer_job' ? volunteerJobId : null } : {}),
      ...(status ? { status } : {}),
      updatedAt: new Date().toISOString()
    }

    const updated = await db
      .update(volunteerAssignments)
      .set(updatePayload)
      .where(eq(volunteerAssignments.id, assignmentId))
      .returning()

    if (!updated.length) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    }

    return NextResponse.json({ assignment: updated[0] })
  } catch (error) {
    console.error('Error updating volunteer assignment:', error)
    return NextResponse.json({ error: 'Failed to update assignment' }, { status: 500 })
  }
}
