import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUserSession } from '@/lib/server-auth'

import { getGuardianById, createScheduleComment, getScheduleCommentsForTeacher, getClassTeachingRequestsByGuardian } from '@/lib/database'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const auth = await getAuthenticatedUserSession()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    
    const { session } = auth
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId } = await params
    
    // Verify user is a guardian and has approved class teaching requests (is a teacher)
    const guardian = await getGuardianById(session.user.id)
    if (!guardian) {
      return NextResponse.json({ error: 'Guardian not found' }, { status: 404 })
    }

    const teachingRequests = await getClassTeachingRequestsByGuardian(guardian.id)
    const hasApprovedRequests = teachingRequests.some(req => req.status === 'approved')
    
    if (!hasApprovedRequests) {
      return NextResponse.json({ error: 'Access denied. Only approved teachers can view schedule comments.' }, { status: 403 })
    }

    const comments = await getScheduleCommentsForTeacher(sessionId, guardian.id)

    return NextResponse.json({ comments })
  } catch (error) {
    console.error('Error fetching schedule comments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const auth = await getAuthenticatedUserSession()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    
    const { session } = auth
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId } = await params
    const body = await request.json()
    const { comment, isPublic } = body

    if (!comment || typeof comment !== 'string' || comment.trim().length === 0) {
      return NextResponse.json({ error: 'Comment is required' }, { status: 400 })
    }

    // Verify user is a guardian and has approved class teaching requests (is a teacher)
    const guardian = await getGuardianById(session.user.id)
    if (!guardian) {
      return NextResponse.json({ error: 'Guardian not found' }, { status: 404 })
    }

    const teachingRequests = await getClassTeachingRequestsByGuardian(guardian.id)
    const hasApprovedRequests = teachingRequests.some(req => req.status === 'approved')
    
    if (!hasApprovedRequests) {
      return NextResponse.json({ error: 'Access denied. Only approved teachers can submit schedule comments.' }, { status: 403 })
    }

    const newComment = await createScheduleComment({
      sessionId,
      guardianId: guardian.id,
      comment: comment.trim(),
      isPublic: Boolean(isPublic)
    })

    return NextResponse.json({ comment: newComment }, { status: 201 })
  } catch (error) {
    console.error('Error creating schedule comment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}