import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { volunteerJobs, sessionVolunteerJobs, guardians } from '@/lib/schema'
import { eq } from 'drizzle-orm'

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 5)
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
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
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { session } = auth

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
