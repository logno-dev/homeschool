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
  sessions,
  sessionVolunteerJobs,
  familySessionFees
} from '@/lib/schema'
import { eq, and, inArray, or, gt, not, isNotNull } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { createOrUpdateFamilySessionFee } from '@/lib/fee-calculation'
import { isGradeWithinRange } from '@/lib/grades'
import { publishRegistrationUpdate } from '@/lib/registration-events'
import { getRegistrationAccess } from '@/lib/user-groups'
import { getGlobalSetting } from '@/lib/database'
import { sendRegistrationOverrideNotificationEmail, sendRegistrationConfirmationEmail } from '@/lib/email'
import { canSignUpForVolunteerJob, getVisibleVolunteerJobs } from '@/lib/volunteer-job-access'

interface PendingRegistration {
  scheduleId: string
  childId: string
  className: string
  period: string
  teacher: string
  classroom: string
  status?: 'registered' | 'waitlisted'
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

async function withRegistrationRetry<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation()
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : ''
      const isLockConflict = message.includes('busy') || message.includes('locked') || message.includes('conflict')
      if (!isLockConflict || attempt >= 2) throw error
      await new Promise((resolve) => setTimeout(resolve, 75 * (attempt + 1)))
    }
  }
}

interface EmergencyContact {
  name: string
  phone: string
}

interface ConflictDetails {
  type: 'class_full' | 'volunteer_full' | 'child_conflict' | 'guardian_conflict' | 'grade_range'
  scheduleId?: string
  volunteerJobId?: string
  period: string
  className?: string
  jobTitle?: string
  message: string
}

const normalizePeriod = (period: string) => {
  switch (period) {
    case '1':
    case 'first':
      return 'first'
    case '2':
    case 'second':
      return 'second'
    case '3':
    case 'third':
      return 'third'
    case 'lunch':
      return 'lunch'
    case 'non_period':
      return 'non_period'
    default:
      return period
  }
}

const getPeriodAliases = (period: string) => {
  const normalized = normalizePeriod(period)
  const numericLookup: Record<string, string | undefined> = {
    first: '1',
    second: '2',
    third: '3'
  }
  const numeric = numericLookup[normalized]
  return Array.from(new Set([period, normalized, numeric].filter((value): value is string => typeof value === 'string' && value.length > 0)))
}

interface ValidationResult {
  success: boolean
  conflicts?: ConflictDetails[]
  gradeRangeConflicts?: ConflictDetails[]
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
  guardianId: string,
  excludeFamilyId?: string,
  preservedAssignmentIds: string[] = []
): Promise<ValidationResult> {
  const conflicts: ConflictDetails[] = []
  const gradeRangeConflicts: ConflictDetails[] = []
  const now = new Date().toISOString()
  
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

      const childRecord = await db
        .select({ grade: children.grade })
        .from(children)
        .where(and(
          eq(children.id, registration.childId),
          eq(children.familyId, familyId)
        ))
        .limit(1)

      const childGrade = childRecord[0]?.grade
      const gradeAllowed = isGradeWithinRange(
        childGrade,
        classTeachingRequest.gradeRangeFrom,
        classTeachingRequest.gradeRangeTo,
        classTeachingRequest.gradeRange
      )

      if (!gradeAllowed) {
        const gradeConflict: ConflictDetails = {
          type: 'grade_range',
          scheduleId: registration.scheduleId,
          period: registration.period,
          className: registration.className,
          message: `Child grade is outside the allowed range for "${registration.className}"`
        }
        conflicts.push(gradeConflict)
        gradeRangeConflicts.push(gradeConflict)
      }
      
      if (registration.status !== 'waitlisted') {
        const currentRegistrations = await db
          .select()
          .from(classRegistrations)
          .where(eq(classRegistrations.scheduleId, registration.scheduleId))

        const totalRegistrations = currentRegistrations.filter((row) => (
          (!excludeFamilyId || row.familyId !== excludeFamilyId) &&
          (row.status === 'registered' ||
            row.status === 'pending' ||
            (row.status === 'hold' && row.holdExpiresAt && row.holdExpiresAt > now && row.familyId !== familyId))
        )).length

        // A full class is not a submission conflict. It becomes a waitlist entry
        // during the authoritative write below.
      }
    }

    // Check for child period conflicts
    if (registration.status !== 'waitlisted') {
      const existingRegistration = await db
        .select({
          status: classRegistrations.status,
          scheduleId: classRegistrations.scheduleId,
               familyId: classRegistrations.familyId,
               holdExpiresAt: classRegistrations.holdExpiresAt
             })
        .from(classRegistrations)
        .innerJoin(schedules, eq(classRegistrations.scheduleId, schedules.id))
        .where(and(
          eq(classRegistrations.childId, registration.childId),
          eq(classRegistrations.sessionId, sessionId),
          eq(schedules.period, registration.period),
          excludeFamilyId ? not(eq(classRegistrations.familyId, excludeFamilyId)) : undefined,
          or(
            inArray(classRegistrations.status, ['registered', 'pending']),
            and(eq(classRegistrations.status, 'hold'), gt(classRegistrations.holdExpiresAt, now))
          )
        ))
        .limit(1)

      if (existingRegistration.length > 0) {
        const existing = existingRegistration[0]
        const isOwnSelection =
          ['hold', 'registered'].includes(existing.status) &&
          existing.familyId === familyId &&
          existing.scheduleId === registration.scheduleId

        if (isOwnSelection) {
          continue
        }
        conflicts.push({
          type: 'child_conflict',
          scheduleId: registration.scheduleId,
          period: registration.period,
          className: registration.className,
          message: `Child is already registered for a class in the ${registration.period} period`
        })
      }
    }
  }

  // Check for volunteer assignment conflicts
  for (const assignment of volunteerAssignmentsList) {
    const normalizedPeriod = normalizePeriod(assignment.period)
    const periodAliases = getPeriodAliases(assignment.period)
    // Check if guardian is already assigned for this period
    const existingAssignment = await db
      .select({
        id: volunteerAssignments.id,
        status: volunteerAssignments.status,
        familyId: volunteerAssignments.familyId,
        scheduleId: volunteerAssignments.scheduleId,
        volunteerJobId: volunteerAssignments.volunteerJobId,
        volunteerType: volunteerAssignments.volunteerType,
        holdExpiresAt: volunteerAssignments.holdExpiresAt
      })
      .from(volunteerAssignments)
      .where(and(
        eq(volunteerAssignments.guardianId, assignment.guardianId),
        eq(volunteerAssignments.sessionId, sessionId),
        inArray(volunteerAssignments.period, periodAliases),
        or(
          inArray(volunteerAssignments.status, ['assigned', 'pending']),
          and(eq(volunteerAssignments.status, 'hold'), gt(volunteerAssignments.holdExpiresAt, now))
        )
      ))

    const relevantAssignments = excludeFamilyId
      ? existingAssignment.filter((entry) => entry.familyId !== excludeFamilyId)
      : existingAssignment
    if (relevantAssignments.length > 0) {
      const existing = relevantAssignments[0]
      const matchesAssignment = existing.scheduleId
        ? existing.scheduleId === assignment.scheduleId
        : existing.volunteerJobId === assignment.volunteerJobId
      const isOwnSelection = (['hold', 'assigned'].includes(existing.status) || preservedAssignmentIds.includes(existing.id)) && existing.familyId === familyId && existing.volunteerType === assignment.volunteerType && matchesAssignment

      if (isOwnSelection) {
        continue
      }
      conflicts.push({
        type: 'guardian_conflict',
        scheduleId: assignment.scheduleId,
        volunteerJobId: assignment.volunteerJobId,
        period: normalizedPeriod,
        className: assignment.className,
        jobTitle: assignment.jobTitle,
        message: `Guardian is already assigned as a volunteer for the ${normalizedPeriod} period`
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
            eq(volunteerAssignments.volunteerType, 'helper'),
            or(
              inArray(volunteerAssignments.status, ['assigned', 'pending']),
              and(eq(volunteerAssignments.status, 'hold'), gt(volunteerAssignments.holdExpiresAt, now))
            )
          ))

        const availableHelpers = excludeFamilyId
          ? currentHelpers.filter((entry) => entry.familyId !== excludeFamilyId)
          : currentHelpers
        if (availableHelpers.length >= classTeachingRequest.helpersNeeded) {
          conflicts.push({
            type: 'volunteer_full',
            scheduleId: assignment.scheduleId,
            period: assignment.period,
            className: assignment.className,
            message: `No helper spots available for "${assignment.className}" (${availableHelpers.length}/${classTeachingRequest.helpersNeeded})`
          })
        }
      }
    }

    if (assignment.volunteerJobId && assignment.volunteerType === 'volunteer_job') {
      const sessionJob = await db
        .select({ quantityAvailable: sessionVolunteerJobs.quantityAvailable })
        .from(sessionVolunteerJobs)
        .where(and(
          eq(sessionVolunteerJobs.sessionId, sessionId),
          eq(sessionVolunteerJobs.volunteerJobId, assignment.volunteerJobId)
        ))
        .limit(1)

      if (sessionJob.length > 0) {
        const currentAssignments = await db
          .select()
          .from(volunteerAssignments)
          .where(and(
            eq(volunteerAssignments.sessionId, sessionId),
            eq(volunteerAssignments.volunteerJobId, assignment.volunteerJobId),
            eq(volunteerAssignments.period, normalizedPeriod),
            or(
              inArray(volunteerAssignments.status, ['assigned', 'pending']),
              and(eq(volunteerAssignments.status, 'hold'), gt(volunteerAssignments.holdExpiresAt, now))
            )
          ))

        const totalAssignments = currentAssignments.filter((entry) => (
          (!excludeFamilyId || entry.familyId !== excludeFamilyId) &&
          (entry.status === 'assigned' ||
            entry.status === 'pending' ||
            (entry.status === 'hold' && entry.holdExpiresAt && entry.holdExpiresAt > now && entry.familyId !== familyId))
        )).length

        if (totalAssignments >= sessionJob[0].quantityAvailable) {
          conflicts.push({
            type: 'volunteer_full',
            volunteerJobId: assignment.volunteerJobId,
            period: normalizedPeriod,
            jobTitle: assignment.jobTitle,
            message: `No spots available for "${assignment.jobTitle || 'volunteer job'}" (${totalAssignments}/${sessionJob[0].quantityAvailable})`
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
  const periodsWithStudents = new Set(
    registrations
      .filter((registration) => registration.status !== 'waitlisted')
      .map(r => r.period)
      .filter(p => p !== 'lunch')
  )
  const requiredHours = periodsWithStudents.size

  const coveredPeriods = new Set(
    volunteerAssignmentsList
      .map(a => normalizePeriod(a.period))
      .filter(period => period !== 'non_period' && periodsWithStudents.has(period))
  )

  teachingAssignmentsForValidation
    .filter((t: any) => t.period !== 'lunch' && periodsWithStudents.has(t.period))
    .forEach((t: any) => coveredPeriods.add(t.period))

  const nonPeriodVolunteerHours = volunteerAssignmentsList.filter(a => a.period === 'non_period').length
  const remainingPeriods = Math.max(0, requiredHours - coveredPeriods.size)
  const wildcardCoverage = Math.min(nonPeriodVolunteerHours, remainingPeriods)
  const fulfilledHours = coveredPeriods.size + wildcardCoverage

  const volunteerRequirementsMet = fulfilledHours >= requiredHours

  return {
    success: conflicts.length === 0 && volunteerRequirementsMet,
    conflicts: conflicts.length > 0 ? conflicts : undefined,
    gradeRangeConflicts: gradeRangeConflicts.length > 0 ? gradeRangeConflicts : undefined,
    volunteerRequirementsMet,
    requiredHours,
    fulfilledHours,
    canRequestOverride: (!volunteerRequirementsMet && conflicts.length === 0) ||
      (gradeRangeConflicts.length > 0 && gradeRangeConflicts.length === conflicts.length)
  }
}

export async function POST(request: Request) {
  let processingStarted = false
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
      volunteerAssignments: requestedVolunteers,
      requestAdminOverride = false,
      modifyRegistration = false,
      overrideReason: requestedOverrideReason
    }: {
      sessionId: string
      registrations: PendingRegistration[]
      volunteerAssignments: PendingVolunteerAssignment[]
      emergencyContact: EmergencyContact
      requestAdminOverride?: boolean
      modifyRegistration?: boolean
      overrideReason?: string
    } = body
    if (!Array.isArray(registrations) || !Array.isArray(requestedVolunteers)) return NextResponse.json({ error: 'Registration selections must be lists' }, { status: 400 })
    const volunteerAssignmentsList = [...requestedVolunteers]

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
    const familyGuardianIds = (await db.select({ id: guardians.id }).from(guardians).where(eq(guardians.familyId, familyId))).map((member) => member.id)
    if ((volunteerAssignmentsList || []).some((assignment) => !familyGuardianIds.includes(assignment.guardianId))) {
      return NextResponse.json({ error: 'Volunteer assignments must belong to your family' }, { status: 400 })
    }
    if (volunteerAssignmentsList.some(assignment => !['teacher', 'helper', 'co_teacher', 'volunteer_job'].includes(assignment.volunteerType) || (assignment.volunteerJobId && assignment.volunteerType !== 'volunteer_job') || (assignment.volunteerType === 'volunteer_job' && (!assignment.volunteerJobId || assignment.scheduleId)))) {
      return NextResponse.json({ error: 'Invalid volunteer job selection' }, { status: 400 })
    }
    const savedJobs = await db.select().from(volunteerAssignments).where(and(
      eq(volunteerAssignments.familyId, familyId), eq(volunteerAssignments.sessionId, sessionId),
      eq(volunteerAssignments.volunteerType, 'volunteer_job'), inArray(volunteerAssignments.status, ['assigned', 'pending'])
    ))
    const sameJob = (saved: typeof savedJobs[number], selection: PendingVolunteerAssignment) => saved.guardianId === selection.guardianId && saved.volunteerJobId === selection.volunteerJobId && normalizePeriod(saved.period) === normalizePeriod(selection.period)
    for (const assignment of volunteerAssignmentsList) {
      if (assignment.volunteerType !== 'volunteer_job' || savedJobs.some(saved => sameJob(saved, assignment))) continue
      if (!await canSignUpForVolunteerJob(assignment.volunteerJobId!, sessionId, session.user.id, assignment.guardianId)) {
        return NextResponse.json({ error: 'A selected volunteer job is not available for this user and guardian.' }, { status: 403 })
      }
    }
    // Hidden, previously committed family assignments must survive edits made
    // by another guardian. Keep their details on the server and retain the rows.
    const visibleJobs = savedJobs.length ? await getVisibleVolunteerJobs(session.user.id, []) : new Map<string, string[]>()
    const protectedJobs = savedJobs.filter(saved => !visibleJobs.has(saved.volunteerJobId || ''))
    const protectedJobIds = protectedJobs.map(saved => saved.id)
    for (const saved of protectedJobs) {
      if (!volunteerAssignmentsList.some(selection => sameJob(saved, selection))) volunteerAssignmentsList.push({ guardianId: saved.guardianId, period: normalizePeriod(saved.period), volunteerType: 'volunteer_job', volunteerJobId: saved.volunteerJobId!, guardianName: '', jobTitle: 'Existing family volunteer commitment' })
    }
    const existingFamilyStatus = modifyRegistration
      ? await db.select().from(familyRegistrationStatus).where(and(
        eq(familyRegistrationStatus.familyId, familyId),
        eq(familyRegistrationStatus.sessionId, sessionId)
      )).limit(1)
      : []
    const isPendingOverride = existingFamilyStatus[0]?.status === 'admin_override'

    const registeredChildIds = Array.from(new Set((registrations || []).filter((registration) => registration.status !== 'waitlisted').map((registration) => registration.childId)))
    const emergencyContact = body.emergencyContact as EmergencyContact | undefined
    if (registeredChildIds.length > 0 && (!emergencyContact?.name?.trim() || !emergencyContact?.phone?.trim())) {
      return NextResponse.json({ error: 'Emergency contact name and phone are required for the family' }, { status: 400 })
    }

    // Check registration window access
    const sessionData = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1)
    if (!sessionData.length) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const sessionInfo = sessionData[0]
    const registrationAccess = await getRegistrationAccess(sessionId, session.user.id)
    if (!registrationAccess.isOpen) {
      return NextResponse.json({ error: registrationAccess.reason || 'Registration is not currently available.' }, { status: 403 })
    }

    // Validate registration and detect conflicts
    const validation = await validateRegistration(
      sessionId,
      registrations,
      volunteerAssignmentsList,
      familyId,
      session.user.id,
      modifyRegistration ? familyId : undefined,
      protectedJobIds
    )

    const hasOnlyGradeRangeConflicts =
      validation.gradeRangeConflicts &&
      validation.conflicts &&
      validation.conflicts.length === validation.gradeRangeConflicts.length
    const overrideReason = [
      !validation.volunteerRequirementsMet ? `Volunteer hours not met: ${validation.fulfilledHours}/${validation.requiredHours} hours fulfilled` : '',
      hasOnlyGradeRangeConflicts ? `Grade range override requested for: ${validation.gradeRangeConflicts?.map((conflict) => conflict.className).filter(Boolean).join(', ') || 'selected classes'}` : ''
    ].filter(Boolean).join(' | ')

    if (validation.conflicts && validation.conflicts.length > 0 && !hasOnlyGradeRangeConflicts) {
      return NextResponse.json({
        success: false,
        conflicts: validation.conflicts,
        message: 'Registration conflicts detected'
      }, { status: 409 })
    }

    if (hasOnlyGradeRangeConflicts && !requestAdminOverride) {
      return NextResponse.json({
        success: false,
        conflicts: validation.conflicts,
        canRequestOverride: true,
        message: 'Some students are outside the class grade range. You can request an admin override.'
      }, { status: 400 })
    }

    // Check for approved admin override
    const existingOverride = await db.query.familyRegistrationStatus.findFirst({
      where: and(
        eq(familyRegistrationStatus.familyId, familyId),
        eq(familyRegistrationStatus.sessionId, sessionId),
        or(
          eq(familyRegistrationStatus.status, 'approved'),
          and(
            inArray(familyRegistrationStatus.status, ['completed', 'in_progress', 'incomplete']),
            eq(familyRegistrationStatus.adminOverride, true),
            isNotNull(familyRegistrationStatus.overriddenBy)
          )
        )
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

    if (modifyRegistration) {
      await withRegistrationRetry(() => db.transaction(async (tx) => {
        await tx.delete(classRegistrations).where(and(
          eq(classRegistrations.familyId, familyId),
          eq(classRegistrations.sessionId, sessionId)
        ))
        await tx.delete(volunteerAssignments).where(and(
          eq(volunteerAssignments.familyId, familyId),
          eq(volunteerAssignments.sessionId, sessionId),
          protectedJobIds.length ? not(inArray(volunteerAssignments.id, protectedJobIds)) : undefined
        ))
       }))
    }

    // Path 3: Handle admin override request
    if ((!validation.volunteerRequirementsMet || hasOnlyGradeRangeConflicts || isPendingOverride) && !existingOverride && (requestAdminOverride || (isPendingOverride && protectedJobs.some(job => job.status === 'pending')))) {
      // Process the registration immediately but with "pending" status to hold slots
        await withRegistrationRetry(() => db.transaction(async (tx) => {
        // Insert class registrations with pending status
        if (registrations && registrations.length > 0) {
          for (const registration of registrations) {
            const registrationStatus = registration.status === 'waitlisted' ? 'waitlisted' : 'pending'
            const [existingHold] = registrationStatus === 'pending' ? await tx.select({ id: classRegistrations.id }).from(classRegistrations).where(and(
              eq(classRegistrations.sessionId, sessionId),
              eq(classRegistrations.familyId, familyId),
              eq(classRegistrations.childId, registration.childId),
              eq(classRegistrations.scheduleId, registration.scheduleId),
              eq(classRegistrations.status, 'hold')
            )).limit(1) : []
            if (existingHold) {
              await tx.update(classRegistrations).set({
                status: 'pending',
                holdExpiresAt: null,
                emergencyContact: emergencyContact?.name?.trim() || null,
                emergencyPhone: emergencyContact?.phone?.trim() || null,
                updatedAt: new Date().toISOString()
              }).where(eq(classRegistrations.id, existingHold.id))
            } else {
              await tx.insert(classRegistrations).values({
                id: randomUUID(),
                sessionId,
                scheduleId: registration.scheduleId,
                childId: registration.childId,
                familyId,
                registeredBy: session.user.id,
                emergencyContact: emergencyContact?.name?.trim() || null,
                emergencyPhone: emergencyContact?.phone?.trim() || null,
                status: registrationStatus
              })
            }
          }
        }

        // Insert volunteer assignments with pending status
        if (volunteerAssignmentsList && volunteerAssignmentsList.length > 0) {
          for (const assignment of volunteerAssignmentsList) {
            if (protectedJobs.some(saved => sameJob(saved, assignment))) continue
            if (assignment.volunteerType === 'volunteer_job' && !await canSignUpForVolunteerJob(assignment.volunteerJobId!, sessionId, session.user.id, assignment.guardianId, tx)) throw new Error('A volunteer job is no longer available for this user and guardian.')
            const [existingHold] = await tx.select({ id: volunteerAssignments.id }).from(volunteerAssignments).where(and(
              eq(volunteerAssignments.sessionId, sessionId),
              eq(volunteerAssignments.familyId, familyId),
              eq(volunteerAssignments.guardianId, assignment.guardianId),
              eq(volunteerAssignments.volunteerType, assignment.volunteerType),
              inArray(volunteerAssignments.period, getPeriodAliases(assignment.period)),
              assignment.scheduleId ? eq(volunteerAssignments.scheduleId, assignment.scheduleId) : eq(volunteerAssignments.volunteerJobId, assignment.volunteerJobId!),
              eq(volunteerAssignments.status, 'hold')
            )).limit(1)
            if (existingHold) {
              await tx.update(volunteerAssignments).set({
                status: 'pending',
                period: normalizePeriod(assignment.period),
                holdExpiresAt: null,
                updatedAt: new Date().toISOString()
              }).where(eq(volunteerAssignments.id, existingHold.id))
            } else {
              await tx.insert(volunteerAssignments).values({
                id: randomUUID(),
                sessionId,
                guardianId: assignment.guardianId,
                familyId,
                period: normalizePeriod(assignment.period),
                volunteerType: assignment.volunteerType,
                scheduleId: assignment.scheduleId,
                volunteerJobId: assignment.volunteerJobId,
                status: 'pending'
              })
            }
          }
        }

        // Store the family registration status
        const overrideReasonParts = [] as string[]
        if (!validation.volunteerRequirementsMet) {
          overrideReasonParts.push(
            `Volunteer hours not met: ${validation.fulfilledHours}/${validation.requiredHours} hours fulfilled`
          )
        }
        if (hasOnlyGradeRangeConflicts && validation.gradeRangeConflicts) {
          const classNames = validation.gradeRangeConflicts
            .map((conflict) => conflict.className)
            .filter(Boolean)
            .join(', ')
          overrideReasonParts.push(`Grade range override requested for: ${classNames || 'selected classes'}`)
        }
        if (typeof requestedOverrideReason === 'string' && requestedOverrideReason.trim()) {
          overrideReasonParts.push(`User reason: ${requestedOverrideReason.trim()}`)
        }

        if (modifyRegistration && existingFamilyStatus[0]) {
          await tx.update(familyRegistrationStatus).set({
            status: 'admin_override',
            volunteerRequirementsMet: validation.volunteerRequirementsMet,
            adminOverride: true,
            adminOverrideReason: overrideReasonParts.join(' | '),
            updatedAt: new Date().toISOString()
          }).where(eq(familyRegistrationStatus.id, existingFamilyStatus[0].id))
        } else {
          await tx.insert(familyRegistrationStatus).values({
            id: randomUUID(),
            sessionId,
            familyId,
            status: 'admin_override',
            volunteerRequirementsMet: validation.volunteerRequirementsMet,
            adminOverride: true,
            adminOverrideReason: overrideReasonParts.join(' | ')
          })
        }
      }))

      const notificationRecipients = (await getGlobalSetting('registration_override_notification_emails'))?.split(',').map((recipient) => recipient.trim()).filter(Boolean) || []
      if (notificationRecipients.length) {
        try {
          await sendRegistrationOverrideNotificationEmail({
            recipients: notificationRecipients,
            firstName: session.user.firstName,
            lastName: session.user.lastName,
            email: session.user.email,
            sessionName: sessionInfo.name,
            reason: overrideReason,
            classNames: registrations.map((registration) => registration.className).filter(Boolean).join(', ')
          })
        } catch (notificationError) {
          console.error('Unable to send registration override notification:', notificationError)
        }
      }
      publishRegistrationUpdate(sessionId)

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

    const holdReferenceTime = new Date().toISOString()

    // Persist the incomplete state before individual writes. If a later write
    // or fee calculation fails, the family can resume instead of appearing done.
    const [completionStatus] = await db.select().from(familyRegistrationStatus).where(and(
      eq(familyRegistrationStatus.familyId, familyId),
      eq(familyRegistrationStatus.sessionId, sessionId)
    )).limit(1)
    const completionStatusId = completionStatus?.id || randomUUID()
    if (completionStatus) {
      await db.update(familyRegistrationStatus).set({ status: 'in_progress', completedAt: null, updatedAt: new Date().toISOString() }).where(eq(familyRegistrationStatus.id, completionStatusId))
    } else {
      await db.insert(familyRegistrationStatus).values({ id: completionStatusId, sessionId, familyId, status: 'in_progress', volunteerRequirementsMet: validation.volunteerRequirementsMet })
    }
    processingStarted = true

    // Process registrations without large transaction to avoid Turso timeouts
    console.log('Starting registration processing...')
    let registeredCount = 0
    let waitlistedCount = 0
    let volunteerCount = 0

    // Process child registrations first
    for (const registration of registrations) {
      console.log(`Processing registration for child ${registration.childId}...`)
      
      // Use smaller transaction for each registration
       await withRegistrationRetry(() => db.transaction(async (tx) => {
        // Retrying an interrupted submission must not reinsert an already
        // committed registration or demote it to a waitlist when the class fills.
        const [savedRegistration] = await tx.select().from(classRegistrations).where(and(
          eq(classRegistrations.sessionId, sessionId),
          eq(classRegistrations.familyId, familyId),
          eq(classRegistrations.childId, registration.childId),
          eq(classRegistrations.scheduleId, registration.scheduleId),
          eq(classRegistrations.status, registration.status === 'waitlisted' ? 'waitlisted' : 'registered')
        )).limit(1)
        if (savedRegistration) {
          if (savedRegistration.status === 'registered') registeredCount++
          else waitlistedCount++
          return
        }
        // Check if child is already registered for a class in this period
        console.log('Checking existing registration...')
        let registrationStatus: 'registered' | 'waitlisted' = registration.status === 'waitlisted' ? 'waitlisted' : 'registered'
        if (registrationStatus !== 'waitlisted') {
          const existingRegistration = await tx
            .select({
              id: classRegistrations.id,
              status: classRegistrations.status,
              scheduleId: classRegistrations.scheduleId,
              familyId: classRegistrations.familyId,
               holdExpiresAt: classRegistrations.holdExpiresAt
             })
            .from(classRegistrations)
            .innerJoin(schedules, eq(classRegistrations.scheduleId, schedules.id))
            .where(and(
              eq(classRegistrations.childId, registration.childId),
              eq(classRegistrations.sessionId, sessionId),
              eq(schedules.period, registration.period),
              or(
                inArray(classRegistrations.status, ['registered', 'pending']),
                and(eq(classRegistrations.status, 'hold'), gt(classRegistrations.holdExpiresAt, holdReferenceTime))
              )
            ))
            .limit(1)
          console.log('Existing registration check complete')

          if (existingRegistration.length > 0) {
            const existing = existingRegistration[0]
            const isOwnHold =
              existing.status === 'hold' &&
              existing.familyId === familyId &&
              existing.scheduleId === registration.scheduleId

            if (!isOwnHold) {
              throw new Error(`Child is already registered for a class in the ${registration.period} period`)
            }
          }
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
        if (registration.status !== 'waitlisted') {
          const currentRegistrations = await tx
            .select()
            .from(classRegistrations)
            .where(eq(classRegistrations.scheduleId, registration.scheduleId))

          const totalRegistrations = currentRegistrations.filter((row) =>
            row.status === 'registered' ||
            row.status === 'pending' ||
            (row.status === 'hold' && row.holdExpiresAt && row.holdExpiresAt > holdReferenceTime && row.familyId !== familyId)
          ).length

          if (totalRegistrations >= classTeachingRequest.maxStudents) registrationStatus = 'waitlisted'
        }

        // Register the child
        if (registrationStatus === 'registered') {
          const existingHold = await tx
            .select({ id: classRegistrations.id })
            .from(classRegistrations)
            .where(and(
              eq(classRegistrations.sessionId, sessionId),
              eq(classRegistrations.familyId, familyId),
              eq(classRegistrations.childId, registration.childId),
              eq(classRegistrations.scheduleId, registration.scheduleId),
              eq(classRegistrations.status, 'hold'),
              gt(classRegistrations.holdExpiresAt, holdReferenceTime)
            ))
            .limit(1)

          if (existingHold.length > 0) {
            await tx
              .update(classRegistrations)
              .set({
                status: 'registered',
                holdExpiresAt: null,
             emergencyContact: emergencyContact?.name?.trim() || null,
             emergencyPhone: emergencyContact?.phone?.trim() || null,
                updatedAt: new Date().toISOString()
              })
              .where(eq(classRegistrations.id, existingHold[0].id))
          } else {
            const registrationId = randomUUID()
            await tx.insert(classRegistrations).values({
              id: registrationId,
              sessionId,
              scheduleId: registration.scheduleId,
              childId: registration.childId,
              familyId,
              registeredBy: session.user.id,
              emergencyContact: emergencyContact?.name?.trim() || null,
              emergencyPhone: emergencyContact?.phone?.trim() || null,
              status: registrationStatus
            })
          }
        } else {
          const registrationId = randomUUID()
          await tx.insert(classRegistrations).values({
            id: registrationId,
            sessionId,
            scheduleId: registration.scheduleId,
            childId: registration.childId,
            familyId,
            registeredBy: session.user.id,
            emergencyContact: emergencyContact?.name?.trim() || null,
            emergencyPhone: emergencyContact?.phone?.trim() || null,
            status: registrationStatus
          })
        }

        if (registrationStatus === 'registered') registeredCount++
        else waitlistedCount++
      }))
    }

    // Process volunteer assignments
    for (const assignment of volunteerAssignmentsList) {
      const normalizedPeriod = normalizePeriod(assignment.period)
      const periodAliases = getPeriodAliases(assignment.period)
      await db.transaction(async (tx) => {
        // Check if guardian is already assigned for this period
        const existingAssignment = await tx
          .select({
            id: volunteerAssignments.id,
            status: volunteerAssignments.status,
            familyId: volunteerAssignments.familyId,
            scheduleId: volunteerAssignments.scheduleId,
            volunteerJobId: volunteerAssignments.volunteerJobId,
            volunteerType: volunteerAssignments.volunteerType,
            holdExpiresAt: volunteerAssignments.holdExpiresAt
          })
          .from(volunteerAssignments)
          .where(and(
            eq(volunteerAssignments.guardianId, assignment.guardianId),
            eq(volunteerAssignments.sessionId, sessionId),
            inArray(volunteerAssignments.period, periodAliases),
            or(
              inArray(volunteerAssignments.status, ['assigned', 'pending']),
              and(eq(volunteerAssignments.status, 'hold'), gt(volunteerAssignments.holdExpiresAt, holdReferenceTime))
            )
          ))

        if (existingAssignment.length > 0) {
          const existing = existingAssignment[0]
          const matchesAssignment = existing.scheduleId
            ? existing.scheduleId === assignment.scheduleId
            : existing.volunteerJobId === assignment.volunteerJobId
          const isOwnHold = existing.status === 'hold' && existing.familyId === familyId && existing.volunteerType === assignment.volunteerType && matchesAssignment

          if ((existing.status === 'assigned' || protectedJobIds.includes(existing.id)) && existing.familyId === familyId && existing.volunteerType === assignment.volunteerType && matchesAssignment) {
            volunteerCount++
            return
          }

          if (!isOwnHold) {
            throw new Error(`Guardian is already assigned as a volunteer for the ${normalizedPeriod} period`)
          }
        }

        if (assignment.volunteerType === 'volunteer_job' && !await canSignUpForVolunteerJob(assignment.volunteerJobId!, sessionId, session.user.id, assignment.guardianId, tx)) throw new Error('A volunteer job is no longer available for this user and guardian.')

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

          // A cart hold already occupies this volunteer's spot. Find the exact
          // hold being confirmed before checking whether another spot is needed.
          const existingHold = await tx
            .select({ id: volunteerAssignments.id })
            .from(volunteerAssignments)
            .where(and(
              eq(volunteerAssignments.sessionId, sessionId),
              eq(volunteerAssignments.familyId, familyId),
              eq(volunteerAssignments.guardianId, assignment.guardianId),
              eq(volunteerAssignments.scheduleId, assignment.scheduleId),
              eq(volunteerAssignments.volunteerType, assignment.volunteerType),
              inArray(volunteerAssignments.period, periodAliases),
              eq(volunteerAssignments.status, 'hold'),
              gt(volunteerAssignments.holdExpiresAt, holdReferenceTime)
            ))
            .limit(1)

          // Check capacity based on volunteer type
          if (assignment.volunteerType === 'helper') {
            const currentHelpers = await tx
              .select()
              .from(volunteerAssignments)
              .where(and(
                eq(volunteerAssignments.scheduleId, assignment.scheduleId),
                eq(volunteerAssignments.volunteerType, 'helper'),
                or(
                  inArray(volunteerAssignments.status, ['assigned', 'pending']),
                  and(eq(volunteerAssignments.status, 'hold'), gt(volunteerAssignments.holdExpiresAt, holdReferenceTime))
                )
              ))

            const otherHelpers = currentHelpers.filter(helper => helper.id !== existingHold[0]?.id)
            if (otherHelpers.length >= classTeachingRequest.helpersNeeded) {
              throw new Error(`No helper spots available for: ${assignment.className}`)
            }
          }

          if (existingHold.length > 0) {
            await tx
              .update(volunteerAssignments)
              .set({
                status: 'assigned',
                period: normalizedPeriod,
                holdExpiresAt: null,
                updatedAt: new Date().toISOString()
              })
              .where(eq(volunteerAssignments.id, existingHold[0].id))
          } else {
            const assignmentId = randomUUID()
            await tx.insert(volunteerAssignments).values({
              id: assignmentId,
              sessionId,
              guardianId: assignment.guardianId,
              familyId,
              period: normalizedPeriod,
              volunteerType: assignment.volunteerType,
              scheduleId: assignment.scheduleId,
              status: 'assigned'
            })
          }
        } 
        // Handle admin-created volunteer jobs
        else if (assignment.volunteerJobId && assignment.volunteerType === 'volunteer_job') {
          const existingHold = await tx
            .select({ id: volunteerAssignments.id })
            .from(volunteerAssignments)
            .where(and(
              eq(volunteerAssignments.sessionId, sessionId),
              eq(volunteerAssignments.familyId, familyId),
              eq(volunteerAssignments.guardianId, assignment.guardianId),
              eq(volunteerAssignments.volunteerJobId, assignment.volunteerJobId),
              eq(volunteerAssignments.period, normalizedPeriod),
              eq(volunteerAssignments.status, 'hold'),
              gt(volunteerAssignments.holdExpiresAt, holdReferenceTime)
            ))
            .limit(1)

          if (existingHold.length > 0) {
            await tx
              .update(volunteerAssignments)
              .set({
                status: 'assigned',
                holdExpiresAt: null,
                updatedAt: new Date().toISOString()
              })
              .where(eq(volunteerAssignments.id, existingHold[0].id))
          } else {
            const assignmentId = randomUUID()
            await tx.insert(volunteerAssignments).values({
              id: assignmentId,
              sessionId,
              guardianId: assignment.guardianId,
              familyId,
              period: normalizedPeriod,
              volunteerType: assignment.volunteerType,
              volunteerJobId: assignment.volunteerJobId,
              status: 'assigned'
            })
          }
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
      publishRegistrationUpdate(sessionId)
      return NextResponse.json({ success: false, registrationIncomplete: true, error: 'Your selections were saved, but session fees could not be generated. Reopen registration and use Complete registration to retry.' }, { status: 503 })
    }

    await db.update(familyRegistrationStatus).set({
      status: 'completed',
      volunteerRequirementsMet: validation.volunteerRequirementsMet,
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }).where(eq(familyRegistrationStatus.id, completionStatusId))

    try {
      const [fee] = await db.select().from(familySessionFees).where(and(
        eq(familySessionFees.sessionId, sessionId),
        eq(familySessionFees.familyId, familyId)
      )).limit(1)
       await sendRegistrationConfirmationEmail({
         to: guardian[0].email,
         firstName: guardian[0].firstName,
         sessionName: sessionInfo.name,
         classNames: (registrations || []).map((registration) => registration.className).join(', '),
         totalAmount: fee?.totalFee || 0,
         amountPaid: fee?.paidAmount || 0,
         balanceDue: fee ? Math.max(0, fee.totalFee - fee.paidAmount) : 0
       })
    } catch (emailError) {
      console.error('Error sending registration confirmation:', emailError)
    }

    publishRegistrationUpdate(sessionId)

    return NextResponse.json({ 
      success: true, 
      registeredCount,
      waitlistedCount,
      volunteerCount,
      message: 'Batch registration successful'
    })

  } catch (error) {
    console.error('Error in batch registration:', error)
    return NextResponse.json({ 
      error: processingStarted
        ? `Registration was interrupted after saving some selections. Reopen registration to finish. ${error instanceof Error ? error.message : ''}`
        : error instanceof Error ? error.message : 'Internal server error',
      registrationIncomplete: processingStarted
    }, { status: 500 })
  }
}
