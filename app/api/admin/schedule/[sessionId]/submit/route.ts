import { NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { schedules } from '@/lib/schema'
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

    // Validate that we have schedule entries
    if (!scheduleEntries || scheduleEntries.length === 0) {
      return NextResponse.json(
        { error: 'Cannot submit empty schedule' },
        { status: 400 }
      )
    }

    // Clear existing entries for this session
    await db.delete(schedules).where(eq(schedules.sessionId, sessionId))

    // Insert new schedule entries with submitted status
    const newEntries = scheduleEntries.map((entry: any) => ({
      id: generateId(),
      sessionId: sessionId,
      classTeachingRequestId: entry.classTeachingRequestId,
      classroomId: entry.classroomId,
      period: entry.period,
      status: 'submitted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))

    await db.insert(schedules).values(newEntries)

    return NextResponse.json({ message: 'Schedule submitted successfully' })
  } catch (error) {
    console.error('Error submitting schedule:', error)
    return NextResponse.json(
      { error: 'Failed to submit schedule' },
      { status: 500 }
    )
  }
}
