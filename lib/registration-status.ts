import 'server-only'
import { db } from '@/lib/db'
import {
  familyRegistrationStatus,
  classRegistrations,
  volunteerAssignments,
  schedules,
  classTeachingRequests,
  sessionClassrooms,
  volunteerJobs,
  familySessionFees,
  children
} from '@/lib/schema'
import { and, eq, inArray, or, gt } from 'drizzle-orm'
import { getGuardianById, getGuardiansByFamily } from '@/lib/database'

export async function getRegistrationStatus(sessionId: string, userId: string) {
  const guardian = await getGuardianById(userId)
  if (!guardian?.familyId) {
    return {
      registrationState: 'not_started',
      hasRegistrations: false,
      classRegistrations: [],
      volunteerAssignments: [],
      heldClassRegistrations: [],
      heldVolunteerAssignments: [],
      status: null,
      familyGuardians: [],
      canRegister: false
    }
  }

  const familyId = guardian.familyId
  const now = new Date().toISOString()

  const [familyGuardians, registrationStatus, allClassRegs, allVolunteerRegs, feeRecords] = await Promise.all([
    getGuardiansByFamily(familyId),
    db
      .select()
      .from(familyRegistrationStatus)
      .where(and(
        eq(familyRegistrationStatus.familyId, familyId),
        eq(familyRegistrationStatus.sessionId, sessionId)
      ))
      .limit(1),
    db
      .select({
        registration: classRegistrations,
        schedule: schedules,
        classTeachingRequest: classTeachingRequests,
        classroom: sessionClassrooms,
        child: children
      })
      .from(classRegistrations)
      .innerJoin(schedules, eq(classRegistrations.scheduleId, schedules.id))
      .innerJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
      .innerJoin(sessionClassrooms, eq(schedules.sessionClassroomId, sessionClassrooms.id))
      .innerJoin(children, eq(classRegistrations.childId, children.id))
      .where(and(
        eq(classRegistrations.familyId, familyId),
        eq(classRegistrations.sessionId, sessionId),
        or(inArray(classRegistrations.status, ['registered', 'waitlisted', 'pending']), and(eq(classRegistrations.status, 'hold'), gt(classRegistrations.holdExpiresAt, now)))
      )),
    db
      .select({
        assignment: volunteerAssignments,
        schedule: schedules,
        classTeachingRequest: classTeachingRequests,
        classroom: sessionClassrooms,
        volunteerJob: volunteerJobs
      })
      .from(volunteerAssignments)
      .leftJoin(schedules, eq(volunteerAssignments.scheduleId, schedules.id))
      .leftJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
      .leftJoin(sessionClassrooms, eq(schedules.sessionClassroomId, sessionClassrooms.id))
      .leftJoin(volunteerJobs, eq(volunteerAssignments.volunteerJobId, volunteerJobs.id))
      .where(and(
        eq(volunteerAssignments.familyId, familyId),
        eq(volunteerAssignments.sessionId, sessionId),
        or(inArray(volunteerAssignments.status, ['assigned', 'pending']), and(eq(volunteerAssignments.status, 'hold'), gt(volunteerAssignments.holdExpiresAt, now)))
      )),
    db.select({ id: familySessionFees.id }).from(familySessionFees).where(and(eq(familySessionFees.familyId, familyId), eq(familySessionFees.sessionId, sessionId))).limit(1)
  ])

  const classRegs = allClassRegs.filter(record => record.registration.status !== 'hold')
  const volunteerRegs = allVolunteerRegs.filter(record => record.assignment.status !== 'hold')
  const hasRegistrations = classRegs.length > 0 || volunteerRegs.length > 0
  const status = registrationStatus.length > 0 ? registrationStatus[0] : null

  let registrationState = 'not_started'
  if (status) {
    registrationState = status.status
  } else if (hasRegistrations) {
    registrationState = feeRecords.length ? 'completed' : 'in_progress'
  }
  if (registrationState === 'completed' && hasRegistrations && !feeRecords.length) registrationState = 'in_progress'

  const normalizeVolunteer = (record: typeof allVolunteerRegs[number]) => ({
    ...record,
    schedule: record.schedule || undefined,
    classTeachingRequest: record.classTeachingRequest || undefined,
    classroom: record.classroom || undefined
  })

  return {
    registrationState,
    hasRegistrations,
    classRegistrations: classRegs,
    volunteerAssignments: volunteerRegs.map(normalizeVolunteer),
    heldClassRegistrations: allClassRegs.filter(record => record.registration.status === 'hold'),
    heldVolunteerAssignments: allVolunteerRegs.filter(record => record.assignment.status === 'hold').map(normalizeVolunteer),
    status,
    familyGuardians,
    canRegister: ['not_started', 'in_progress', 'incomplete', 'approved'].includes(registrationState)
  }
}
