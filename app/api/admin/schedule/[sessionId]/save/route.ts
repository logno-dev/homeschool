import { NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { schedules, sessionClassrooms } from '@/lib/schema'
import { eq } from 'drizzle-orm'

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

    // Clear existing draft entries for this session
    await db.delete(schedules).where(eq(schedules.sessionId, sessionId))

    const sessionRooms = await db
      .select({ id: sessionClassrooms.id, classroomId: sessionClassrooms.classroomId })
      .from(sessionClassrooms)
      .where(eq(sessionClassrooms.sessionId, sessionId))
    const roomLookup = new Map(sessionRooms.map((room) => [room.id, room.classroomId]))

    // Insert new schedule entries
    if (scheduleEntries && scheduleEntries.length > 0) {
      const newEntries = scheduleEntries.map((entry: any) => {
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

    return NextResponse.json({ message: 'Draft saved successfully' })
  } catch (error) {
    console.error('Error saving draft:', error)
    return NextResponse.json(
      { error: 'Failed to save draft' },
      { status: 500 }
    )
  }
}
