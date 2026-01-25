import { NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { sessions, type NewSession } from '@/lib/schema'
import { ensureSessionClassrooms, ensureSessionVolunteerJobs } from '@/lib/database'

// Helper function to generate IDs (same as in database.ts)
function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 5)
}

export async function GET() {
  try {
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    // Fetch all sessions
    const allSessions = await db.select().from(sessions)
    return NextResponse.json({ sessions: allSessions })
  } catch (error) {
    console.error('Error fetching sessions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json()
    const { 
      name, 
      startDate, 
      endDate, 
      registrationStartDate, 
      registrationEndDate, 
      teacherRegistrationStartDate,
      description,
      isActive 
    } = body

    // Validate required fields
    if (!name || !startDate || !endDate || !registrationStartDate || !registrationEndDate) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // If setting this session as active, deactivate all other sessions
    if (isActive) {
      await db.update(sessions).set({ isActive: false })
    }

    const newSession: NewSession = {
      id: generateId(),
      name,
      startDate,
      endDate,
      registrationStartDate,
      registrationEndDate,
      teacherRegistrationStartDate: teacherRegistrationStartDate || null,
      description: description || null,
      isActive: isActive || false,
    }

    const [createdSession] = await db.insert(sessions).values(newSession).returning()
    await ensureSessionClassrooms(createdSession.id)
    await ensureSessionVolunteerJobs(createdSession.id)
    return NextResponse.json({ session: createdSession }, { status: 201 })
  } catch (error) {
    console.error('Error creating session:', error)
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    )
  }
}
