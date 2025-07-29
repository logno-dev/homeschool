import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { sessions, type NewSession } from '@/lib/schema'

// Helper function to generate IDs (same as in database.ts)
function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 5)
}

export async function GET() {
  try {
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
    return NextResponse.json({ session: createdSession }, { status: 201 })
  } catch (error) {
    console.error('Error creating session:', error)
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    )
  }
}