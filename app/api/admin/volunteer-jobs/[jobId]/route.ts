import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { volunteerJobs, sessionVolunteerJobs, guardians } from '@/lib/schema'
import { eq } from 'drizzle-orm'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { jobId } = await params
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

    const updateData: any = {
      title,
      description,
      quantityAvailable,
      updatedAt: new Date().toISOString(),
    }

    if (jobType) {
      updateData.jobType = jobType
    }

    const updatedJob = await db.update(volunteerJobs)
      .set(updateData)
      .where(eq(volunteerJobs.id, jobId))
      .returning()

    if (!updatedJob.length) {
      return NextResponse.json({ error: 'Volunteer job not found' }, { status: 404 })
    }

    return NextResponse.json(updatedJob[0])
  } catch (error) {
    console.error('Error updating volunteer job:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { jobId } = await params

    const deletedJob = await db.delete(volunteerJobs)
      .where(eq(volunteerJobs.id, jobId))
      .returning()

    if (!deletedJob.length) {
      return NextResponse.json({ error: 'Volunteer job not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'Volunteer job deleted successfully' })
  } catch (error) {
    console.error('Error deleting volunteer job:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
