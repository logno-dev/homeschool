import { NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { schedules, sessionClassrooms, classRegistrations, volunteerAssignments } from '@/lib/schema'
import { and, eq, inArray } from 'drizzle-orm'

// Helper function to generate IDs
function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 5)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json()
    const { scheduleEntries } = body

    const existingSchedules = await db.select().from(schedules).where(eq(schedules.sessionId, sessionId))
    const protectedRegistrationRows = await db
      .select({ scheduleId: classRegistrations.scheduleId })
      .from(classRegistrations)
      .where(and(
        eq(classRegistrations.sessionId, sessionId),
        inArray(classRegistrations.status, ['registered', 'pending', 'hold'])
      ))
    const protectedVolunteerRows = await db
      .select({ scheduleId: volunteerAssignments.scheduleId })
      .from(volunteerAssignments)
      .where(and(
        eq(volunteerAssignments.sessionId, sessionId),
        inArray(volunteerAssignments.status, ['assigned', 'pending', 'hold'])
      ))
    const protectedScheduleIds = new Set([
      ...protectedRegistrationRows.map((row) => row.scheduleId),
      ...protectedVolunteerRows.map((row) => row.scheduleId).filter((id): id is string => Boolean(id))
    ])
    const incomingByClass = new Map<string, any>((scheduleEntries || []).map((entry: any) => [entry.classTeachingRequestId, entry]))
    const impacted = [] as Array<{ classTeachingRequestId: string; scheduleId: string; change: 'moved' | 'removed' }>

    for (const existing of existingSchedules) {
      const incoming = incomingByClass.get(existing.classTeachingRequestId)
      const isSamePlacement = incoming
        && (incoming.classroomId === existing.sessionClassroomId || incoming.classroomId === existing.classroomId)
        && incoming.period === existing.period

      if (protectedScheduleIds.has(existing.id)) {
        if (isSamePlacement || existing.status !== 'published') {
          await db.update(schedules).set({ status: 'draft', updatedAt: new Date().toISOString() }).where(eq(schedules.id, existing.id))
        } else {
          impacted.push({
            classTeachingRequestId: existing.classTeachingRequestId,
            scheduleId: existing.id,
            change: incoming ? 'moved' : 'removed'
          })
          await db.update(schedules).set({ status: 'holding', updatedAt: new Date().toISOString() }).where(eq(schedules.id, existing.id))
          await db.update(classRegistrations).set({ status: 'hold', holdExpiresAt: null, updatedAt: new Date().toISOString() }).where(and(
            eq(classRegistrations.scheduleId, existing.id),
            inArray(classRegistrations.status, ['registered', 'pending', 'hold'])
          ))
          await db.update(volunteerAssignments).set({ status: 'hold', holdExpiresAt: null, updatedAt: new Date().toISOString() }).where(and(
            eq(volunteerAssignments.scheduleId, existing.id),
            inArray(volunteerAssignments.status, ['assigned', 'pending', 'hold'])
          ))
        }
      } else {
        await db.delete(schedules).where(eq(schedules.id, existing.id))
      }
    }

    const sessionRooms = await db
      .select({ id: sessionClassrooms.id, classroomId: sessionClassrooms.classroomId })
      .from(sessionClassrooms)
      .where(eq(sessionClassrooms.sessionId, sessionId))
    const roomLookup = new Map(sessionRooms.map((room) => [room.id, room.classroomId]))

    // Insert new schedule entries
    if (scheduleEntries && scheduleEntries.length > 0) {
      const retainedScheduleIds = new Set(existingSchedules.filter((entry) => {
        const incoming = incomingByClass.get(entry.classTeachingRequestId)
        return protectedScheduleIds.has(entry.id) && incoming
          && (incoming.classroomId === entry.sessionClassroomId || incoming.classroomId === entry.classroomId)
          && incoming.period === entry.period
      }).map((entry) => entry.classTeachingRequestId))
      const newEntries = scheduleEntries.filter((entry: any) => !retainedScheduleIds.has(entry.classTeachingRequestId)).map((entry: any) => {
        const resolvedClassroomId = roomLookup.get(entry.classroomId)
        if (!resolvedClassroomId) {
          throw new Error('Classroom not found for schedule entry')
        }
        return {
        id: generateId(),
        sessionId: sessionId,
        classTeachingRequestId: entry.classTeachingRequestId,
        classroomId: resolvedClassroomId,
        sessionClassroomId: entry.classroomId,
        period: entry.period,
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        }
      })

      await db.insert(schedules).values(newEntries)
    }

    return NextResponse.json({ message: 'Draft saved successfully', impacted })
  } catch (error) {
    console.error('Error saving draft:', error)
    return NextResponse.json(
      { error: 'Failed to save draft' },
      { status: 500 }
    )
  }
}
