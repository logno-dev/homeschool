import { NextResponse } from 'next/server'
import { getAuthenticatedUserSession } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { guardians, families, children, classRegistrations, schedules, classTeachingRequests, volunteerAssignments } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'

interface FamilyRegistration {
  [period: string]: {
    [childId: string]: string // scheduleId
  }
}

interface VolunteerAssignment {
  [period: string]: {
    guardianId: string
    scheduleId: string
    type: 'helper' | 'teacher'
  }
}

export async function GET() {
  try {
    const auth = await getAuthenticatedUserSession()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    
    const { session } = auth
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    // Get family details
    const family = await db
      .select()
      .from(families)
      .where(eq(families.id, familyId))
      .limit(1)

    if (!family.length) {
      return NextResponse.json({ error: 'Family not found' }, { status: 404 })
    }

    // Get all children in the family
    const familyChildren = await db
      .select()
      .from(children)
      .where(eq(children.familyId, familyId))

    // Get all guardians in the family
    const familyGuardians = await db
      .select({
        id: guardians.id,
        firstName: guardians.firstName,
        lastName: guardians.lastName,
        email: guardians.email,
        isMainContact: guardians.isMainContact
      })
      .from(guardians)
      .where(eq(guardians.familyId, familyId))

    // Get current registrations for the family
    const currentRegistrations = await db
      .select({
        registration: classRegistrations,
        schedule: schedules,
        classTeachingRequest: classTeachingRequests,
        child: children
      })
      .from(classRegistrations)
      .innerJoin(schedules, eq(classRegistrations.scheduleId, schedules.id))
      .innerJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
      .innerJoin(children, eq(classRegistrations.childId, children.id))
      .where(eq(classRegistrations.familyId, familyId))

    return NextResponse.json({
      family: family[0],
      children: familyChildren,
      guardians: familyGuardians,
      currentRegistrations
    })
  } catch (error) {
    console.error('Error fetching family data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

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
      registrations,
      volunteerAssignments: volunteerData
    }: {
      sessionId: string
      registrations: FamilyRegistration
      volunteerAssignments: VolunteerAssignment
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

    // Validate all children belong to this family
    const allChildIds = Object.values(registrations).flatMap(periodRegs => Object.keys(periodRegs))
    if (allChildIds.length > 0) {
      const familyChildren = await db
        .select()
        .from(children)
        .where(eq(children.familyId, familyId))

      const familyChildIds = familyChildren.map(child => child.id)
      const invalidChildIds = allChildIds.filter(childId => !familyChildIds.includes(childId))
      
      if (invalidChildIds.length > 0) {
        return NextResponse.json({ 
          error: 'Some children do not belong to your family' 
        }, { status: 400 })
      }
    }

    // Validate all volunteer guardians belong to this family
    const allVolunteerGuardianIds = Object.values(volunteerData).map(assignment => assignment.guardianId)
    if (allVolunteerGuardianIds.length > 0) {
      const familyGuardians = await db
        .select()
        .from(guardians)
        .where(eq(guardians.familyId, familyId))

      const familyGuardianIds = familyGuardians.map(guardian => guardian.id)
      const invalidGuardianIds = allVolunteerGuardianIds.filter(guardianId => !familyGuardianIds.includes(guardianId))
      
      if (invalidGuardianIds.length > 0) {
        return NextResponse.json({ 
          error: 'Some guardians do not belong to your family' 
        }, { status: 400 })
      }
    }

    // Start transaction
    const result = await db.transaction(async (tx) => {
      const registrationIds: string[] = []
      const volunteerAssignmentIds: string[] = []

      // Process child registrations
      for (const [period, periodRegistrations] of Object.entries(registrations)) {
        for (const [childId, scheduleId] of Object.entries(periodRegistrations)) {
          // Verify the schedule exists and is published
          const scheduleData = await tx
            .select({
              schedule: schedules,
              classTeachingRequest: classTeachingRequests
            })
            .from(schedules)
            .innerJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
            .where(and(
              eq(schedules.id, scheduleId),
              eq(schedules.sessionId, sessionId),
              eq(schedules.status, 'published'),
              eq(schedules.period, period)
            ))
            .limit(1)

          if (!scheduleData.length) {
            throw new Error(`Invalid schedule for ${period} period`)
          }

          const { schedule, classTeachingRequest } = scheduleData[0]

          // Check if child is already registered for this period
          const existingRegistration = await tx
            .select()
            .from(classRegistrations)
            .innerJoin(schedules, eq(classRegistrations.scheduleId, schedules.id))
            .where(and(
              eq(classRegistrations.childId, childId),
              eq(classRegistrations.sessionId, sessionId),
              eq(schedules.period, period)
            ))
            .limit(1)

          if (existingRegistration.length > 0) {
            throw new Error(`Child is already registered for a class in the ${period} period`)
          }

          // Check class capacity
          const currentRegistrations = await tx
            .select()
            .from(classRegistrations)
            .where(eq(classRegistrations.scheduleId, scheduleId))

          if (currentRegistrations.length >= classTeachingRequest.maxStudents) {
            throw new Error(`Class ${classTeachingRequest.className} is full`)
          }

          // Register the child
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

          registrationIds.push(registrationId)
        }
      }

      // Process volunteer assignments
      for (const [period, assignment] of Object.entries(volunteerData)) {
        const { guardianId, scheduleId, type } = assignment

        // Verify the schedule exists and is published
        const scheduleData = await tx
          .select({
            schedule: schedules,
            classTeachingRequest: classTeachingRequests
          })
          .from(schedules)
          .innerJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
          .where(and(
            eq(schedules.id, scheduleId),
            eq(schedules.sessionId, sessionId),
            eq(schedules.status, 'published'),
            eq(schedules.period, period)
          ))
          .limit(1)

        if (!scheduleData.length) {
          throw new Error(`Invalid volunteer schedule for ${period} period`)
        }

        const { classTeachingRequest } = scheduleData[0]

        // Check if there are volunteer spots available
        if (type === 'helper') {
          const currentHelpers = await tx
            .select()
            .from(volunteerAssignments)
            .where(and(
              eq(volunteerAssignments.scheduleId, scheduleId),
              eq(volunteerAssignments.volunteerType, 'helper')
            ))

          if (currentHelpers.length >= classTeachingRequest.helpersNeeded) {
            throw new Error(`No helper spots available for ${classTeachingRequest.className}`)
          }
        }

        // Check if guardian is already assigned for this period
        const existingAssignment = await tx
          .select()
          .from(volunteerAssignments)
          .innerJoin(schedules, eq(volunteerAssignments.scheduleId, schedules.id))
          .where(and(
            eq(volunteerAssignments.guardianId, guardianId),
            eq(volunteerAssignments.sessionId, sessionId),
            eq(schedules.period, period)
          ))

        if (existingAssignment.length > 0) {
          throw new Error(`Guardian is already assigned as a volunteer for the ${period} period`)
        }

        // Add volunteer assignment
        const assignmentId = randomUUID()
        await tx.insert(volunteerAssignments).values({
          id: assignmentId,
          sessionId,
          guardianId,
          familyId,
          period,
          volunteerType: type,
          scheduleId,
          status: 'assigned'
        })

        volunteerAssignmentIds.push(assignmentId)
      }

      return { registrationIds, volunteerAssignmentIds }
    })

    return NextResponse.json({ 
      success: true, 
      registrationIds: result.registrationIds,
      volunteerAssignmentIds: result.volunteerAssignmentIds,
      message: 'Family registration successful'
    })

  } catch (error) {
    console.error('Error processing family registration:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 })
  }
}