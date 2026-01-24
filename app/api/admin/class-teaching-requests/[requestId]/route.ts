import { NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { 
  getClassTeachingRequestById,
  approveClassTeachingRequest,
  rejectClassTeachingRequest,
  updateClassTeachingRequest,
  getGuardianById
} from '@/lib/database'
import { getGradeRangeFromLabel } from '@/lib/grades'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
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
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { session } = auth

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
      if (!['approve', 'reject', 'request_changes'].includes(action)) {
        return NextResponse.json(
          { error: 'Valid action (approve, reject, or request_changes) is required' },
          { status: 400 }
        )
      }

      if (action === 'approve') {
        updatedRequest = await approveClassTeachingRequest(requestId, reviewer.id, reviewNotes)
      } else if (action === 'reject') {
        updatedRequest = await rejectClassTeachingRequest(requestId, reviewer.id, reviewNotes)
      } else {
        updatedRequest = await updateClassTeachingRequest(requestId, {
          status: 'changes_requested',
          reviewedBy: reviewer.id,
          reviewedAt: new Date().toISOString(),
          reviewNotes: reviewNotes?.trim() || null
        })
      }
    } else {
      // Handle editing the request fields
      const updateData: any = {}
      
      if (editData.className !== undefined) updateData.className = editData.className.trim()
      if (editData.description !== undefined) updateData.description = editData.description.trim()
      if (editData.gradeRange !== undefined) updateData.gradeRange = editData.gradeRange.trim()
      if (editData.gradeRangeFrom !== undefined) updateData.gradeRangeFrom = editData.gradeRangeFrom
      if (editData.gradeRangeTo !== undefined) updateData.gradeRangeTo = editData.gradeRangeTo
      if (editData.maxStudents !== undefined) updateData.maxStudents = parseInt(editData.maxStudents)
      if (editData.helpersNeeded !== undefined) updateData.helpersNeeded = parseInt(editData.helpersNeeded)
      if (editData.coTeacher !== undefined) updateData.coTeacher = editData.coTeacher?.trim() || null
      if (editData.classroomNeeds !== undefined) updateData.classroomNeeds = editData.classroomNeeds?.trim() || null
      if (editData.requiresFee !== undefined) updateData.requiresFee = editData.requiresFee
      if (editData.feeAmount !== undefined) updateData.feeAmount = editData.requiresFee ? parseFloat(editData.feeAmount) : null
      if (editData.schedulingRequirements !== undefined) updateData.schedulingRequirements = editData.schedulingRequirements?.trim() || null

      if (updateData.gradeRange && (updateData.gradeRangeFrom === undefined || updateData.gradeRangeTo === undefined)) {
        const fallbackRange = getGradeRangeFromLabel(updateData.gradeRange)
        if (updateData.gradeRangeFrom === undefined) {
          updateData.gradeRangeFrom = fallbackRange.from
        }
        if (updateData.gradeRangeTo === undefined) {
          updateData.gradeRangeTo = fallbackRange.to
        }
      }

      if (updateData.gradeRangeFrom !== undefined && updateData.gradeRangeTo !== undefined) {
        if (updateData.gradeRangeFrom !== null && updateData.gradeRangeTo !== null && updateData.gradeRangeFrom > updateData.gradeRangeTo) {
          return NextResponse.json(
            { error: 'Grade range start must be lower than end.' },
            { status: 400 }
          )
        }
      }

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
