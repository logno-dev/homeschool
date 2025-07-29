import { NextResponse } from 'next/server'
import { getAuthenticatedUserSession } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { 
  familyRegistrationStatus,
  guardians,
  classRegistrations,
  volunteerAssignments,
  schedules,
  classTeachingRequests,
  classrooms,
  children
} from '@/lib/schema'
import { eq, and } from 'drizzle-orm'

export async function GET(request: Request) {
  try {
    const auth = await getAuthenticatedUserSession()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    
    const { session } = auth

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 })
    }

    // Get the guardian's family information
    const guardian = await db
      .select()
      .from(guardians)
      .where(eq(guardians.id, session.user.id))
      .limit(1)

    if (!guardian.length || !guardian[0].familyId) {
      return NextResponse.json({ error: 'Family not found' }, { status: 404 })
    }

    const familyId = guardian[0].familyId

    // Get all family guardians for teacher detection
    const familyGuardians = await db
      .select({
        id: guardians.id,
        firstName: guardians.firstName,
        lastName: guardians.lastName,
        email: guardians.email
      })
      .from(guardians)
      .where(eq(guardians.familyId, familyId))

    // Check family registration status
    const registrationStatus = await db
      .select()
      .from(familyRegistrationStatus)
      .where(and(
        eq(familyRegistrationStatus.familyId, familyId),
        eq(familyRegistrationStatus.sessionId, sessionId)
      ))
      .limit(1)

    // Check if family has any class registrations for this session
    const classRegs = await db
      .select({
        registration: classRegistrations,
        schedule: schedules,
        classTeachingRequest: classTeachingRequests,
        classroom: classrooms,
        child: children
      })
      .from(classRegistrations)
      .innerJoin(schedules, eq(classRegistrations.scheduleId, schedules.id))
      .innerJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
      .innerJoin(classrooms, eq(schedules.classroomId, classrooms.id))
      .innerJoin(children, eq(classRegistrations.childId, children.id))
      .where(and(
        eq(classRegistrations.familyId, familyId),
        eq(classRegistrations.sessionId, sessionId)
      ))

    // Check if family has any volunteer assignments for this session
    const volunteerRegs = await db
      .select({
        assignment: volunteerAssignments,
        schedule: schedules,
        classTeachingRequest: classTeachingRequests,
        classroom: classrooms
      })
      .from(volunteerAssignments)
      .leftJoin(schedules, eq(volunteerAssignments.scheduleId, schedules.id))
      .leftJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
      .leftJoin(classrooms, eq(schedules.classroomId, classrooms.id))
      .where(and(
        eq(volunteerAssignments.familyId, familyId),
        eq(volunteerAssignments.sessionId, sessionId)
      ))

    const hasRegistrations = classRegs.length > 0 || volunteerRegs.length > 0
    const status = registrationStatus.length > 0 ? registrationStatus[0] : null

    // Determine registration state
    let registrationState = 'not_started'
    if (status) {
      registrationState = status.status
    } else if (hasRegistrations) {
      registrationState = 'completed'
    }

    return NextResponse.json({
      registrationState,
      hasRegistrations,
      classRegistrations: classRegs,
      volunteerAssignments: volunteerRegs,
      status: status,
      familyGuardians: familyGuardians,
      canRegister: registrationState === 'not_started' || registrationState === 'in_progress' || registrationState === 'approved'
    })

  } catch (error) {
    console.error('Error checking registration status:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}