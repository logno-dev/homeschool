import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { volunteerJobs, sessionVolunteerJobs, guardians } from '@/lib/schema'
import { eq } from 'drizzle-orm'

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 5)
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || !session.accessToken) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Check if user is admin or moderator using external auth API
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
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 })
    }

    const jobs = await db.select({
      id: volunteerJobs.id,
      sessionVolunteerJobId: volunteerJobs.id, // Using volunteer job ID directly since we removed session junction
      title: volunteerJobs.title,
      description: volunteerJobs.description,
      quantityAvailable: sessionVolunteerJobs.quantityAvailable,
      jobType: volunteerJobs.jobType,
      isActive: sessionVolunteerJobs.isActive,
      createdBy: volunteerJobs.createdBy,
      createdAt: volunteerJobs.createdAt,
      updatedAt: volunteerJobs.updatedAt,
      createdByName: guardians.firstName,
      createdByLastName: guardians.lastName,
    })
    .from(sessionVolunteerJobs)
    .innerJoin(volunteerJobs, eq(sessionVolunteerJobs.volunteerJobId, volunteerJobs.id))
    .leftJoin(guardians, eq(volunteerJobs.createdBy, guardians.id))
    .where(eq(sessionVolunteerJobs.sessionId, sessionId))

    return NextResponse.json(jobs)
  } catch (error) {
    console.error('Error fetching volunteer jobs:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || !session.accessToken) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Check if user is admin or moderator using external auth API
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
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Get guardian record for createdBy field
    const guardian = await db.select().from(guardians).where(eq(guardians.email, session.user.email)).limit(1)
    if (!guardian.length) {
      return NextResponse.json({ error: 'Guardian record not found' }, { status: 404 })
    }

    const body = await request.json()
    const { sessionId, title, description, quantityAvailable, jobType } = body

    if (!sessionId || !title || !description || quantityAvailable === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (jobType && !['period_based', 'non_period'].includes(jobType)) {
      return NextResponse.json({ error: 'Invalid job type' }, { status: 400 })
    }

    if (quantityAvailable < 1) {
      return NextResponse.json({ error: 'Quantity available must be at least 1' }, { status: 400 })
    }

    const jobId = generateId()
    
    // Create the volunteer job
    const newJob = await db.insert(volunteerJobs).values({
      id: jobId,
      title,
      description,
      quantityAvailable,
      jobType: jobType || 'non_period',
      createdBy: guardian[0].id,
    }).returning()

    // Link it to the session
    const sessionJobId = generateId()
    const sessionJob = await db.insert(sessionVolunteerJobs).values({
      id: sessionJobId,
      sessionId,
      volunteerJobId: jobId,
      quantityAvailable,
      isActive: true,
    }).returning()

    return NextResponse.json({
      ...newJob[0],
      sessionVolunteerJobId: jobId, // Using volunteer job ID directly since we removed session junction
      isActive: true
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating volunteer job:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}