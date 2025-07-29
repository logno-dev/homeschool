import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { 
  getClassTeachingRequestById,
  approveClassTeachingRequest,
  rejectClassTeachingRequest,
  updateClassTeachingRequest,
  getGuardianById
} from '@/lib/database'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
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

    const { requestId } = await params
    const teachingRequest = await getClassTeachingRequestById(requestId)
    
    if (!teachingRequest) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ request: teachingRequest })
  } catch (error) {
    console.error('Error fetching class teaching request:', error)
    return NextResponse.json(
      { error: 'Failed to fetch request' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
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

    // Get reviewer guardian record
    const reviewer = await getGuardianById(session.user.id)
    if (!reviewer) {
      return NextResponse.json(
        { error: 'Reviewer record not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { action, reviewNotes, ...editData } = body

    const { requestId } = await params
    
    let updatedRequest

    // If action is provided, handle approval/rejection
    if (action) {
      if (!['approve', 'reject'].includes(action)) {
        return NextResponse.json(
          { error: 'Valid action (approve or reject) is required' },
          { status: 400 }
        )
      }

      if (action === 'approve') {
        updatedRequest = await approveClassTeachingRequest(requestId, reviewer.id, reviewNotes)
      } else {
        updatedRequest = await rejectClassTeachingRequest(requestId, reviewer.id, reviewNotes)
      }
    } else {
      // Handle editing the request fields
      const updateData: any = {}
      
      if (editData.className !== undefined) updateData.className = editData.className.trim()
      if (editData.description !== undefined) updateData.description = editData.description.trim()
      if (editData.gradeRange !== undefined) updateData.gradeRange = editData.gradeRange.trim()
      if (editData.maxStudents !== undefined) updateData.maxStudents = parseInt(editData.maxStudents)
      if (editData.helpersNeeded !== undefined) updateData.helpersNeeded = parseInt(editData.helpersNeeded)
      if (editData.coTeacher !== undefined) updateData.coTeacher = editData.coTeacher?.trim() || null
      if (editData.classroomNeeds !== undefined) updateData.classroomNeeds = editData.classroomNeeds?.trim() || null
      if (editData.requiresFee !== undefined) updateData.requiresFee = editData.requiresFee
      if (editData.feeAmount !== undefined) updateData.feeAmount = editData.requiresFee ? parseFloat(editData.feeAmount) : null
      if (editData.schedulingRequirements !== undefined) updateData.schedulingRequirements = editData.schedulingRequirements?.trim() || null

      updatedRequest = await updateClassTeachingRequest(requestId, updateData)
    }

    if (!updatedRequest) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ request: updatedRequest })
  } catch (error) {
    console.error('Error updating class teaching request:', error)
    return NextResponse.json(
      { error: 'Failed to update request' },
      { status: 500 }
    )
  }
}