import { NextResponse } from 'next/server'
import { getAuthenticatedUserSession } from '@/lib/server-auth'
import { getClassTeachingRequestById, getGuardianById, updateClassTeachingRequest } from '@/lib/database'
import { getGradeRangeFromLabel } from '@/lib/grades'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> }
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

    const guardian = await getGuardianById(session.user.id)
    if (!guardian) {
      return NextResponse.json({ error: 'Guardian record not found' }, { status: 404 })
    }

    const { requestId } = await params
    const existingRequest = await getClassTeachingRequestById(requestId)
    if (!existingRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    if (existingRequest.guardianId !== guardian.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (existingRequest.status !== 'pending' && existingRequest.status !== 'changes_requested') {
      return NextResponse.json({ error: 'Only pending requests can be edited' }, { status: 400 })
    }

    const body = await request.json()
    const {
      className,
      description,
      gradeRange,
      gradeRangeFrom,
      gradeRangeTo,
      maxStudents,
      helpersNeeded,
      coTeacher,
      classroomNeeds,
      requiresFee,
      feeAmount,
      schedulingRequirements
    } = body

    if (!className || !description || !gradeRange || !maxStudents) {
      return NextResponse.json(
        { error: 'Class name, description, grade range, and max students are required' },
        { status: 400 }
      )
    }

    const fallbackRange = getGradeRangeFromLabel(gradeRange)
    const resolvedFrom = typeof gradeRangeFrom === 'number' ? gradeRangeFrom : fallbackRange.from
    const resolvedTo = typeof gradeRangeTo === 'number' ? gradeRangeTo : fallbackRange.to
    if (resolvedFrom !== null && resolvedTo !== null && resolvedFrom > resolvedTo) {
      return NextResponse.json(
        { error: 'Grade range start must be lower than end.' },
        { status: 400 }
      )
    }

    const finalHelpersNeeded = helpersNeeded || (coTeacher?.trim() ? 0 : 1)
    if (finalHelpersNeeded < 0 || finalHelpersNeeded > 10) {
      return NextResponse.json(
        { error: 'Helpers needed must be between 0 and 10' },
        { status: 400 }
      )
    }

    if (requiresFee && (!feeAmount || feeAmount <= 0)) {
      return NextResponse.json(
        { error: 'Fee amount must be greater than 0 when fee is required' },
        { status: 400 }
      )
    }

    const updatedRequest = await updateClassTeachingRequest(requestId, {
      className: className.trim(),
      description: description.trim(),
      gradeRange: gradeRange.trim(),
      gradeRangeFrom: resolvedFrom,
      gradeRangeTo: resolvedTo,
      maxStudents: parseInt(maxStudents, 10),
      helpersNeeded: finalHelpersNeeded,
      coTeacher: coTeacher?.trim() || null,
      classroomNeeds: classroomNeeds?.trim() || null,
       requiresFee: requiresFee || false,
      feeAmount: requiresFee ? feeAmount : null,
      schedulingRequirements: schedulingRequirements?.trim() || null,
      status: 'pending'
    })

    return NextResponse.json({ request: updatedRequest })
  } catch (error) {
    console.error('Error updating class teaching request:', error)
    return NextResponse.json(
      { error: 'Failed to update request' },
      { status: 500 }
    )
  }
}
