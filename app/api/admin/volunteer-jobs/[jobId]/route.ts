import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { volunteerJobs, sessionVolunteerJobs, guardians } from '@/lib/schema'
import { eq } from 'drizzle-orm'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
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