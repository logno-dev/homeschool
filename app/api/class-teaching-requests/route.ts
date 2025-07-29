import { NextResponse } from 'next/server'
import { getAuthenticatedUserSession } from '@/lib/server-auth'

import { 
  createClassTeachingRequest, 
  getClassTeachingRequestsByGuardianWithSession,
  getGuardianById,
  getActiveSession,
  isClassTeachingRegistrationOpen
} from '@/lib/database'
import type { NewClassTeachingRequest } from '@/lib/schema'

export async function GET() {
  try {
    const auth = await getAuthenticatedUserSession()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    
    const { session } = auth
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Get guardian record
    const guardian = await getGuardianById(session.user.id)
    if (!guardian) {
      return NextResponse.json(
        { error: 'Guardian record not found' },
        { status: 404 }
      )
    }

    // Get all requests for this guardian with session info
    const requests = await getClassTeachingRequestsByGuardianWithSession(guardian.id)
    return NextResponse.json({ requests })
  } catch (error) {
    console.error('Error fetching class teaching requests:', error)
    return NextResponse.json(
      { error: 'Failed to fetch requests' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedUserSession()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    
    const { session } = auth
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Get guardian record
    const guardian = await getGuardianById(session.user.id)
    if (!guardian) {
      return NextResponse.json(
        { error: 'Guardian record not found' },
        { status: 404 }
      )
    }

    // Check if class teaching registration is open
    const registrationStatus = await isClassTeachingRegistrationOpen()
    if (!registrationStatus.isOpen) {
      return NextResponse.json(
        { error: registrationStatus.reason || 'Class teaching registration is not open' },
        { status: 400 }
      )
    }

    const activeSession = await getActiveSession()
    if (!activeSession) {
      return NextResponse.json(
        { error: 'No active session found' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { 
      className,
      description,
      gradeRange,
      maxStudents,
      helpersNeeded,
      coTeacher,
      classroomNeeds,
      requiresFee,
      feeAmount,
      schedulingRequirements
    } = body

    // Validate required fields
    if (!className || !description || !gradeRange || !maxStudents) {
      return NextResponse.json(
        { error: 'Class name, description, grade range, and max students are required' },
        { status: 400 }
      )
    }

    // Validate max students
    if (maxStudents < 1 || maxStudents > 100) {
      return NextResponse.json(
        { error: 'Max students must be between 1 and 100' },
        { status: 400 }
      )
    }

    // Validate helpers needed - minimum 1 if no co-teacher
    const finalHelpersNeeded = helpersNeeded || (coTeacher?.trim() ? 0 : 1)
    if (finalHelpersNeeded < 0 || finalHelpersNeeded > 10) {
      return NextResponse.json(
        { error: 'Helpers needed must be between 0 and 10' },
        { status: 400 }
      )
    }

    // Validate fee amount if fee is required
    if (requiresFee && (!feeAmount || feeAmount <= 0)) {
      return NextResponse.json(
        { error: 'Fee amount must be greater than 0 when fee is required' },
        { status: 400 }
      )
    }

    const newRequest: Omit<NewClassTeachingRequest, 'id' | 'createdAt' | 'updatedAt'> = {
      sessionId: activeSession.id,
      guardianId: guardian.id,
      className: className.trim(),
      description: description.trim(),
      gradeRange: gradeRange.trim(),
      maxStudents: parseInt(maxStudents),
      helpersNeeded: finalHelpersNeeded,
      coTeacher: coTeacher?.trim() || null,
      classroomNeeds: classroomNeeds?.trim() || null,
      requiresFee: requiresFee || false,
      feeAmount: requiresFee ? feeAmount : null,
      schedulingRequirements: schedulingRequirements?.trim() || null,
      status: 'pending',
      reviewedBy: null,
      reviewedAt: null,
      reviewNotes: null
    }

    const createdRequest = await createClassTeachingRequest(newRequest)
    return NextResponse.json({ request: createdRequest }, { status: 201 })
  } catch (error) {
    console.error('Error creating class teaching request:', error)
    return NextResponse.json(
      { error: 'Failed to create request' },
      { status: 500 }
    )
  }
}