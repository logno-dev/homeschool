import { NextResponse } from 'next/server'
import { getAuthenticatedUserSession } from '@/lib/server-auth'

import { db } from '@/lib/db'
import { 
  classRegistrations, 
  volunteerAssignments, 
  guardians, 
  schedules, 
  classTeachingRequests,
  children
} from '@/lib/schema'
import { eq, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'

export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedUserSession()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    
    const { session } = auth
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      sessionId, 
      scheduleId, 
      childId, 
      helperGuardianId, // Optional: guardian signing up as helper
      volunteerType, // 'helper' if signing up as helper
    } = body

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

    // Verify the child belongs to this family
    const child = await db
      .select()
      .from(children)
      .where(and(
        eq(children.id, childId),
        eq(children.familyId, familyId)
      ))
      .limit(1)

    if (!child.length) {
      return NextResponse.json({ error: 'Child not found or does not belong to your family' }, { status: 400 })
    }

    // Get the schedule and class details
    const scheduleData = await db
      .select({
        schedule: schedules,
        classTeachingRequest: classTeachingRequests
      })
      .from(schedules)
      .innerJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
      .where(and(
        eq(schedules.id, scheduleId),
        eq(schedules.sessionId, sessionId),
        eq(schedules.status, 'published')
      ))
      .limit(1)

    if (!scheduleData.length) {
      return NextResponse.json({ error: 'Class not found or not available for registration' }, { status: 400 })
    }

    const { schedule, classTeachingRequest } = scheduleData[0]

    // Check if child is already registered for a class in this period
    const existingRegistration = await db
      .select()
      .from(classRegistrations)
      .innerJoin(schedules, eq(classRegistrations.scheduleId, schedules.id))
      .where(and(
        eq(classRegistrations.childId, childId),
        eq(classRegistrations.sessionId, sessionId),
        eq(schedules.period, schedule.period)
      ))
      .limit(1)

    if (existingRegistration.length > 0) {
      return NextResponse.json({ 
        error: `Child is already registered for a class in the ${schedule.period} period` 
      }, { status: 400 })
    }

    // Check class capacity
    const currentRegistrations = await db
      .select()
      .from(classRegistrations)
      .where(eq(classRegistrations.scheduleId, scheduleId))

    if (currentRegistrations.length >= classTeachingRequest.maxStudents) {
      return NextResponse.json({ error: 'Class is full' }, { status: 400 })
    }

    // Start transaction
    const result = await db.transaction(async (tx) => {
      // Register the child for the class
      const registrationId = randomUUID()
      await tx.insert(classRegistrations).values({
        id: registrationId,
        sessionId,
        scheduleId,
        childId,
        familyId,
        registeredBy: session.user.id,
        status: 'registered'
      })

      // If helper signup is requested, add volunteer assignment
      if (helperGuardianId && volunteerType === 'helper') {
        // Check if there are helper spots available
        const currentHelpers = await tx
          .select()
          .from(volunteerAssignments)
          .where(and(
            eq(volunteerAssignments.scheduleId, scheduleId),
            eq(volunteerAssignments.volunteerType, 'helper')
          ))

        if (currentHelpers.length >= classTeachingRequest.helpersNeeded) {
          throw new Error('No helper spots available for this class')
        }

        // Check if guardian is already assigned as helper for this period
        const existingHelperAssignment = await tx
          .select()
          .from(volunteerAssignments)
          .innerJoin(schedules, eq(volunteerAssignments.scheduleId, schedules.id))
          .where(and(
            eq(volunteerAssignments.guardianId, helperGuardianId),
            eq(volunteerAssignments.sessionId, sessionId),
            eq(schedules.period, schedule.period)
          ))

        if (existingHelperAssignment.length > 0) {
          throw new Error('Guardian is already assigned as a volunteer for this period')
        }

        // Add helper assignment
        const assignmentId = randomUUID()
        await tx.insert(volunteerAssignments).values({
          id: assignmentId,
          sessionId,
          guardianId: helperGuardianId,
          familyId,
          period: schedule.period,
          volunteerType: 'helper',
          scheduleId,
          status: 'assigned'
        })
      }

      return { registrationId }
    })

    return NextResponse.json({ 
      success: true, 
      registrationId: result.registrationId,
      message: 'Registration successful'
    })

  } catch (error) {
    console.error('Error registering for class:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 })
  }
}