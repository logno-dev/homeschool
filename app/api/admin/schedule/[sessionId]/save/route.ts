import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
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
    const session = await getServerSession(authOptions)
    
    if (!session?.user || !session.accessToken) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Check if user is admin or moderator
    const roleResponse = await fetch(`${process.env.AUTH_API_URL}/api/user/${session.user.id}/role`, {
      method: 'GET',
      headers: {
        'x-api-key': process.env.AUTH_API_KEY!,
        'Authorization': `Bearer ${session.accessToken}`,
      },
    })

    if (!roleResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to verify role' },
        { status: 403 }
      )
    }

    const roleData = await roleResponse.json()
    if (!['admin', 'moderator'].includes(roleData.user.role)) {
      return NextResponse.json(
        { error: 'Admin or moderator access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { scheduleEntries } = body

    // Clear existing draft entries for this session
    await db.delete(schedules).where(eq(schedules.sessionId, sessionId))

    // Insert new schedule entries
    if (scheduleEntries && scheduleEntries.length > 0) {
      const newEntries = scheduleEntries.map((entry: any) => ({
        id: generateId(),
        sessionId: sessionId,
        classTeachingRequestId: entry.classTeachingRequestId,
        classroomId: entry.classroomId,
        period: entry.period,
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }))

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