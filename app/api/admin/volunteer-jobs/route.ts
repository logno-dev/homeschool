import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { volunteerJobs, sessionVolunteerJobs, guardians } from '@/lib/schema'
import { ensureSessionVolunteerJobs, getActiveSession } from '@/lib/database'
import { eq } from 'drizzle-orm'

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 5)
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin('volunteer-jobs')
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const jobs = await db.select({
      id: volunteerJobs.id,
      title: volunteerJobs.title,
      description: volunteerJobs.description,
      quantityAvailable: volunteerJobs.quantityAvailable,
      jobType: volunteerJobs.jobType,
      isActive: volunteerJobs.isActive,
      createdBy: volunteerJobs.createdBy,
      createdAt: volunteerJobs.createdAt,
      updatedAt: volunteerJobs.updatedAt,
      createdByName: guardians.firstName,
      createdByLastName: guardians.lastName,
    })
    .from(volunteerJobs)
    .leftJoin(guardians, eq(volunteerJobs.createdBy, guardians.id))

    return NextResponse.json(jobs)
  } catch (error) {
    console.error('Error fetching volunteer jobs:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin('volunteer-jobs')
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
    const { title, description, quantityAvailable, jobType } = body

    if (!title || !description || quantityAvailable === undefined) {
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

    const activeSession = await getActiveSession()
    if (activeSession) {
      await ensureSessionVolunteerJobs(activeSession.id)
    }

    return NextResponse.json({
      ...newJob[0],
      jobType: newJob[0].jobType,
      isActive: newJob[0].isActive
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating volunteer job:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
