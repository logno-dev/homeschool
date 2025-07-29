import { NextResponse } from 'next/server'
import { getAuthenticatedUserSession } from '@/lib/server-auth'

import { db } from '@/lib/db'
import { 
  classRegistrations, 
  volunteerAssignments, 
  guardians, 
  schedules, 
  classTeachingRequests,
  children,
  familyRegistrationStatus,
  sessions
} from '@/lib/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { isAfter, isBefore, parseISO } from 'date-fns'
import { createOrUpdateFamilySessionFee } from '@/lib/fee-calculation'

interface PendingRegistration {
  scheduleId: string
  childId: string
  className: string
  period: string
  teacher: string
  classroom: string
}

interface PendingVolunteerAssignment {
  scheduleId?: string // For class-based volunteer jobs (teacher, helper, co_teacher)
  volunteerJobId?: string // For admin-created volunteer jobs
  guardianId: string
  period: string
  volunteerType: 'teacher' | 'helper' | 'co_teacher' | 'volunteer_job'
  className?: string // For class-based jobs
  teacher?: string // For class-based jobs
  classroom?: string // For class-based jobs
  jobTitle?: string // For admin-created jobs
  guardianName: string
}

interface ConflictDetails {
  type: 'class_full' | 'volunteer_full' | 'child_conflict' | 'guardian_conflict'
  scheduleId?: string
  volunteerJobId?: string
  period: string
  className?: string
  jobTitle?: string
  message: string
}

interface ValidationResult {
  success: boolean
  conflicts?: ConflictDetails[]
  volunteerRequirementsMet: boolean
  requiredHours: number
  fulfilledHours: number
  canRequestOverride: boolean
}

// Helper function to validate registration and detect conflicts
async function validateRegistration(
  sessionId: string,
  registrations: PendingRegistration[],
  volunteerAssignmentsList: PendingVolunteerAssignment[],
  familyId: string,
  guardianId: string
): Promise<ValidationResult> {
  const conflicts: ConflictDetails[] = []
  
  // Check for class capacity conflicts
  for (const registration of registrations) {
    const scheduleData = await db
      .select({
        schedule: schedules,
        classTeachingRequest: classTeachingRequests
      })
      .from(schedules)
      .innerJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
      .where(eq(schedules.id, registration.scheduleId))
      .limit(1)

    if (scheduleData.length > 0) {
      const { classTeachingRequest } = scheduleData[0]
      
      const currentRegistrations = await db
        .select()
        .from(classRegistrations)
        .where(eq(classRegistrations.scheduleId, registration.scheduleId))

      if (currentRegistrations.length >= classTeachingRequest.maxStudents) {
        conflicts.push({
          type: 'class_full',
          scheduleId: registration.scheduleId,
          period: registration.period,
          className: registration.className,
          message: `Class "${registration.className}" is full (${currentRegistrations.length}/${classTeachingRequest.maxStudents})`
        })
      }
    }

    // Check for child period conflicts
    const existingRegistration = await db
      .select()
      .from(classRegistrations)
      .innerJoin(schedules, eq(classRegistrations.scheduleId, schedules.id))
      .where(and(
        eq(classRegistrations.childId, registration.childId),
        eq(classRegistrations.sessionId, sessionId),
        eq(schedules.period, registration.period)
      ))
      .limit(1)

    if (existingRegistration.length > 0) {
      conflicts.push({
        type: 'child_conflict',
        scheduleId: registration.scheduleId,
        period: registration.period,
        className: registration.className,
        message: `Child is already registered for a class in the ${registration.period} period`
      })
    }
  }

  // Check for volunteer assignment conflicts
  for (const assignment of volunteerAssignmentsList) {
    // Check if guardian is already assigned for this period
    const existingAssignment = await db
      .select()
      .from(volunteerAssignments)
      .where(and(
        eq(volunteerAssignments.guardianId, assignment.guardianId),
        eq(volunteerAssignments.sessionId, sessionId),
        eq(volunteerAssignments.period, assignment.period)
      ))

    if (existingAssignment.length > 0) {
      conflicts.push({
        type: 'guardian_conflict',
        scheduleId: assignment.scheduleId,
        volunteerJobId: assignment.volunteerJobId,
        period: assignment.period,
        className: assignment.className,
        jobTitle: assignment.jobTitle,
        message: `Guardian is already assigned as a volunteer for the ${assignment.period} period`
      })
    }

    // Check volunteer capacity for class-based assignments
    if (assignment.scheduleId && assignment.volunteerType === 'helper') {
      const scheduleData = await db
        .select({
          schedule: schedules,
          classTeachingRequest: classTeachingRequests
        })
        .from(schedules)
        .innerJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
        .where(eq(schedules.id, assignment.scheduleId))
        .limit(1)

      if (scheduleData.length > 0) {
        const { classTeachingRequest } = scheduleData[0]
        
        const currentHelpers = await db
          .select()
          .from(volunteerAssignments)
          .where(and(
            eq(volunteerAssignments.scheduleId, assignment.scheduleId),
            eq(volunteerAssignments.volunteerType, 'helper')
          ))

        if (currentHelpers.length >= classTeachingRequest.helpersNeeded) {
          conflicts.push({
            type: 'volunteer_full',
            scheduleId: assignment.scheduleId,
            period: assignment.period,
            className: assignment.className,
            message: `No helper spots available for "${assignment.className}" (${currentHelpers.length}/${classTeachingRequest.helpersNeeded})`
          })
        }
      }
    }
  }

  // Get teaching assignments for any guardian in the family
  const familyGuardiansForValidation = await db
    .select({ id: guardians.id })
    .from(guardians)
    .where(eq(guardians.familyId, familyId))

  const familyGuardianIdsForValidation = familyGuardiansForValidation.map(g => g.id)

  let teachingAssignmentsForValidation: any[] = []
  if (familyGuardianIdsForValidation.length > 0) {
    teachingAssignmentsForValidation = await db
      .select({
        period: schedules.period
      })
      .from(schedules)
      .innerJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
      .where(and(
        eq(schedules.sessionId, sessionId),
        inArray(classTeachingRequests.guardianId, familyGuardianIdsForValidation)
      ))
  }

  // Calculate volunteer requirements
  // Required hours: 1 hour per period with students (excluding lunch)
  const periodsWithStudents = new Set(registrations.map(r => r.period).filter(p => p !== 'lunch'))
  const requiredHours = periodsWithStudents.size
  
  // Fulfilled hours: Total volunteer assignments + teaching assignments (regardless of period)
  // Count period-based volunteer assignments (excluding non-period jobs)
  const periodBasedVolunteerHours = volunteerAssignmentsList.filter(a => a.period !== 'non_period').length
  
  // Count non-period volunteer jobs (each counts as 1 hour regardless of period)
  const nonPeriodVolunteerHours = volunteerAssignmentsList.filter(a => a.period === 'non_period').length
  
  // Count teaching assignments (each counts as 1 hour per period, excluding lunch)
  const teachingHours = teachingAssignmentsForValidation.filter((t: any) => t.period !== 'lunch').length
  
  const fulfilledHours = periodBasedVolunteerHours + nonPeriodVolunteerHours + teachingHours
  
  const volunteerRequirementsMet = fulfilledHours >= requiredHours

  return {
    success: conflicts.length === 0 && volunteerRequirementsMet,
    conflicts: conflicts.length > 0 ? conflicts : undefined,
    volunteerRequirementsMet,
    requiredHours,
    fulfilledHours,
    canRequestOverride: !volunteerRequirementsMet && conflicts.length === 0
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
      volunteerAssignments: volunteerAssignmentsList,
      requestAdminOverride = false
    }: {
      sessionId: string
      registrations: PendingRegistration[]
      volunteerAssignments: PendingVolunteerAssignment[]
      requestAdminOverride?: boolean
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

    // Check registration window access
    const sessionData = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1)
    if (!sessionData.length) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const sessionInfo = sessionData[0]
    const now = new Date()
    const registrationStart = parseISO(sessionInfo.registrationStartDate)
    const registrationEnd = parseISO(sessionInfo.registrationEndDate)
    const teacherEarlyStart = sessionInfo.teacherRegistrationStartDate ? parseISO(sessionInfo.teacherRegistrationStartDate) : null

    // Check if any guardian in the family is teaching any classes (for early access)
    const familyGuardians = await db
      .select({ id: guardians.id })
      .from(guardians)
      .where(eq(guardians.familyId, familyId))

    const familyGuardianIds = familyGuardians.map(g => g.id)

    let teachingAssignments: any[] = []
    if (familyGuardianIds.length > 0) {
      teachingAssignments = await db
        .select({
          period: schedules.period,
          guardianId: classTeachingRequests.guardianId
        })
        .from(schedules)
        .innerJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
        .where(and(
          eq(schedules.sessionId, sessionId),
          inArray(classTeachingRequests.guardianId, familyGuardianIds)
        ))
    }

    const isTeacher = teachingAssignments.length > 0

    // Check if registration is allowed
    let canRegister = false
    if (isAfter(now, registrationStart) && isBefore(now, registrationEnd)) {
      canRegister = true
    } else if (isTeacher && teacherEarlyStart && isAfter(now, teacherEarlyStart) && isBefore(now, registrationStart)) {
      canRegister = true
    }

    if (!canRegister) {
      let message = 'Registration is not currently available.'
      if (isBefore(now, teacherEarlyStart || registrationStart)) {
        if (isTeacher && teacherEarlyStart) {
          message = `Teacher early registration opens on ${teacherEarlyStart.toLocaleDateString()}`
        } else {
          message = `Registration opens on ${registrationStart.toLocaleDateString()}`
        }
      } else if (isAfter(now, registrationEnd)) {
        message = `Registration closed on ${registrationEnd.toLocaleDateString()}`
      }
      
      return NextResponse.json({ 
        error: message 
      }, { status: 403 })
    }

    // Validate registration and detect conflicts
    const validation = await validateRegistration(
      sessionId,
      registrations,
      volunteerAssignmentsList,
      familyId,
      session.user.id
    )

    // Path 2: If there are conflicts, return them for highlighting
    if (validation.conflicts && validation.conflicts.length > 0) {
      return NextResponse.json({
        success: false,
        conflicts: validation.conflicts,
        message: 'Registration conflicts detected'
      }, { status: 409 })
    }

    // Check for approved admin override
    const existingOverride = await db.query.familyRegistrationStatus.findFirst({
      where: and(
        eq(familyRegistrationStatus.familyId, familyId),
        eq(familyRegistrationStatus.sessionId, sessionId),
        eq(familyRegistrationStatus.status, 'approved')
      )
    })

    // Path 3: If volunteer requirements not met and no approved override and not requesting override
    if (!validation.volunteerRequirementsMet && !existingOverride && !requestAdminOverride) {
      return NextResponse.json({
        success: false,
        volunteerRequirementsMet: false,
        requiredHours: validation.requiredHours,
        fulfilledHours: validation.fulfilledHours,
        canRequestOverride: validation.canRequestOverride,
        message: 'Volunteer requirements not met. You can request an admin override.'
      }, { status: 400 })
    }

    // Path 3: Handle admin override request
    if (!validation.volunteerRequirementsMet && !existingOverride && requestAdminOverride) {
      // Process the registration immediately but with "pending" status to hold slots
      await db.transaction(async (tx) => {
        // Insert class registrations with pending status
        if (registrations && registrations.length > 0) {
          for (const registration of registrations) {
            await tx.insert(classRegistrations).values({
              id: randomUUID(),
              sessionId,
              scheduleId: registration.scheduleId,
              childId: registration.childId,
              familyId,
              registeredBy: session.user.id,
              status: 'pending' // Pending admin approval
            })
          }
        }

        // Insert volunteer assignments with pending status
        if (volunteerAssignmentsList && volunteerAssignmentsList.length > 0) {
          for (const assignment of volunteerAssignmentsList) {
            await tx.insert(volunteerAssignments).values({
              id: randomUUID(),
              sessionId,
              guardianId: assignment.guardianId,
              familyId,
              period: assignment.period,
              volunteerType: assignment.volunteerType,
              scheduleId: assignment.scheduleId,
              volunteerJobId: assignment.volunteerJobId,
              status: 'pending' // Pending admin approval
            })
          }
        }

        // Store the family registration status
        await tx.insert(familyRegistrationStatus).values({
          id: randomUUID(),
          sessionId,
          familyId,
          status: 'admin_override',
          volunteerRequirementsMet: false,
          adminOverride: true,
          adminOverrideReason: `Volunteer hours not met: ${validation.fulfilledHours}/${validation.requiredHours} hours fulfilled`
        })
      })

      return NextResponse.json({
        success: true,
        adminOverrideRequested: true,
        message: 'Admin override requested. Your registration is pending admin approval.'
      })
    }

    // Path 1: Complete registration (volunteer hours met, no conflicts, or approved override)
    // Continue with existing validation and registration logic

    // Validate all children belong to this family
    const childIds = registrations.map(r => r.childId)
    if (childIds.length > 0) {
      const familyChildren = await db
        .select()
        .from(children)
        .where(and(
          eq(children.familyId, familyId)
        ))

      const familyChildIds = familyChildren.map(c => c.id)
      const invalidChildIds = childIds.filter(id => !familyChildIds.includes(id))
      
      if (invalidChildIds.length > 0) {
        return NextResponse.json({ 
          error: 'Some children do not belong to your family' 
        }, { status: 400 })
      }
    }

    // Validate all schedules exist and are published
    const allScheduleIds = [
      ...registrations.map(r => r.scheduleId),
      ...volunteerAssignmentsList.filter(v => v.scheduleId).map(v => v.scheduleId!)
    ]
    
    if (allScheduleIds.length > 0) {
      const validSchedules = await db
        .select()
        .from(schedules)
        .where(and(
          eq(schedules.sessionId, sessionId),
          eq(schedules.status, 'published')
        ))

      const validScheduleIds = validSchedules.map(s => s.id)
      const invalidScheduleIds = allScheduleIds.filter(id => !validScheduleIds.includes(id))
      
      if (invalidScheduleIds.length > 0) {
        return NextResponse.json({ 
          error: 'Some classes are not available for registration' 
        }, { status: 400 })
      }
    }

    // Get teaching assignments for any guardian in the family
    const familyGuardiansForFinalCheck = await db
      .select({ id: guardians.id })
      .from(guardians)
      .where(eq(guardians.familyId, familyId))

    const familyGuardianIdsForFinalCheck = familyGuardiansForFinalCheck.map(g => g.id)

    let teachingAssignmentsForFinalCheck: any[] = []
    if (familyGuardianIdsForFinalCheck.length > 0) {
      teachingAssignmentsForFinalCheck = await db
        .select({
          period: schedules.period
        })
        .from(schedules)
        .innerJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
        .where(and(
          eq(schedules.sessionId, sessionId),
          inArray(classTeachingRequests.guardianId, familyGuardianIdsForFinalCheck)
        ))
    }

    // Validate volunteer requirements using total-based logic
    const periodsWithStudents = new Set(registrations.map(r => r.period).filter(p => p !== 'lunch'))
    const requiredHours = periodsWithStudents.size
    
    // Count fulfilled hours: period-based volunteers + non-period volunteers + teaching assignments
    const periodBasedVolunteerHours = volunteerAssignmentsList.filter(a => a.period !== 'non_period').length
    const nonPeriodVolunteerHours = volunteerAssignmentsList.filter(a => a.period === 'non_period').length
    const teachingHours = teachingAssignmentsForFinalCheck.filter((t: any) => t.period !== 'lunch').length
    const fulfilledHours = periodBasedVolunteerHours + nonPeriodVolunteerHours + teachingHours
    
    if (fulfilledHours < requiredHours) {
      return NextResponse.json({ 
        error: `Volunteer requirement not met. You need ${requiredHours} volunteer hours but only have ${fulfilledHours} hours fulfilled. Each family must volunteer for ${requiredHours} hours total (1 hour per period with students).` 
      }, { status: 400 })
    }

    // Process registrations without large transaction to avoid Turso timeouts
    console.log('Starting registration processing...')
    let registeredCount = 0
    let volunteerCount = 0

    // Process child registrations first
    for (const registration of registrations) {
      console.log(`Processing registration for child ${registration.childId}...`)
      
      // Use smaller transaction for each registration
      await db.transaction(async (tx) => {
        // Check if child is already registered for a class in this period
        console.log('Checking existing registration...')
        const existingRegistration = await tx
          .select()
          .from(classRegistrations)
          .innerJoin(schedules, eq(classRegistrations.scheduleId, schedules.id))
          .where(and(
            eq(classRegistrations.childId, registration.childId),
            eq(classRegistrations.sessionId, sessionId),
            eq(schedules.period, registration.period)
          ))
          .limit(1)
        console.log('Existing registration check complete')

        if (existingRegistration.length > 0) {
          throw new Error(`Child is already registered for a class in the ${registration.period} period`)
        }

        // Get class details and check capacity
        const scheduleData = await tx
          .select({
            schedule: schedules,
            classTeachingRequest: classTeachingRequests
          })
          .from(schedules)
          .innerJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
          .where(eq(schedules.id, registration.scheduleId))
          .limit(1)

        if (!scheduleData.length) {
          throw new Error(`Class not found: ${registration.className}`)
        }

        const { classTeachingRequest } = scheduleData[0]

        // Check class capacity
        const currentRegistrations = await tx
          .select()
          .from(classRegistrations)
          .where(eq(classRegistrations.scheduleId, registration.scheduleId))

        if (currentRegistrations.length >= classTeachingRequest.maxStudents) {
          throw new Error(`Class is full: ${registration.className}`)
        }

        // Register the child
        const registrationId = randomUUID()
        await tx.insert(classRegistrations).values({
          id: registrationId,
          sessionId,
          scheduleId: registration.scheduleId,
          childId: registration.childId,
          familyId,
          registeredBy: session.user.id,
          status: 'registered'
        })

        registeredCount++
      })
    }

    // Process volunteer assignments
    for (const assignment of volunteerAssignmentsList) {
      await db.transaction(async (tx) => {
        // Check if guardian is already assigned for this period
        const existingAssignment = await tx
          .select()
          .from(volunteerAssignments)
          .where(and(
            eq(volunteerAssignments.guardianId, assignment.guardianId),
            eq(volunteerAssignments.sessionId, sessionId),
            eq(volunteerAssignments.period, assignment.period)
          ))

        if (existingAssignment.length > 0) {
          throw new Error(`Guardian is already assigned as a volunteer for the ${assignment.period} period`)
        }

        // Handle class-based volunteer assignments (teacher, helper, co_teacher)
        if (assignment.scheduleId && assignment.volunteerType !== 'volunteer_job') {
          // Get class details and check capacity
          const scheduleData = await tx
            .select({
              schedule: schedules,
              classTeachingRequest: classTeachingRequests
            })
            .from(schedules)
            .innerJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
            .where(eq(schedules.id, assignment.scheduleId))
            .limit(1)

          if (!scheduleData.length) {
            throw new Error(`Class not found: ${assignment.className || 'Unknown'}`)
          }

          const { classTeachingRequest } = scheduleData[0]

          // Check capacity based on volunteer type
          if (assignment.volunteerType === 'helper') {
            const currentHelpers = await tx
              .select()
              .from(volunteerAssignments)
              .where(and(
                eq(volunteerAssignments.scheduleId, assignment.scheduleId),
                eq(volunteerAssignments.volunteerType, 'helper')
              ))

            if (currentHelpers.length >= classTeachingRequest.helpersNeeded) {
              throw new Error(`No helper spots available for: ${assignment.className}`)
            }
          }

          // Add volunteer assignment
          const assignmentId = randomUUID()
          await tx.insert(volunteerAssignments).values({
            id: assignmentId,
            sessionId,
            guardianId: assignment.guardianId,
            familyId,
            period: assignment.period,
            volunteerType: assignment.volunteerType,
            scheduleId: assignment.scheduleId,
            status: 'assigned'
          })
        } 
        // Handle admin-created volunteer jobs
        else if (assignment.volunteerJobId && assignment.volunteerType === 'volunteer_job') {
          // Add volunteer assignment for admin job
          const assignmentId = randomUUID()
          await tx.insert(volunteerAssignments).values({
            id: assignmentId,
            sessionId,
            guardianId: assignment.guardianId,
            familyId,
            period: assignment.period,
            volunteerType: assignment.volunteerType,
            volunteerJobId: assignment.volunteerJobId,
            status: 'assigned'
          })
        } else {
          throw new Error(`Invalid volunteer assignment: missing scheduleId or volunteerJobId`)
        }

        volunteerCount++
      })
    }

    // Calculate and create/update family session fees after successful registration
    try {
      await createOrUpdateFamilySessionFee(sessionId, familyId)
    } catch (feeError) {
      console.error('Error calculating fees:', feeError)
      // Don't fail the registration if fee calculation fails, just log it
    }

    return NextResponse.json({ 
      success: true, 
      registeredCount,
      volunteerCount,
      message: 'Batch registration successful'
    })

  } catch (error) {
    console.error('Error in batch registration:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 })
  }
}