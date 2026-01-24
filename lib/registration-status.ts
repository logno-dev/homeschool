import 'server-only'
import { db } from '@/lib/db'
import {
  familyRegistrationStatus,
  classRegistrations,
  volunteerAssignments,
  schedules,
  classTeachingRequests,
  classrooms,
  children
} from '@/lib/schema'
import { and, eq } from 'drizzle-orm'
import { getGuardianById, getGuardiansByFamily } from '@/lib/database'

export async function getRegistrationStatus(sessionId: string, userId: string) {
  const guardian = await getGuardianById(userId)
  if (!guardian?.familyId) {
    return {
      registrationState: 'not_started',
      hasRegistrations: false,
      classRegistrations: [],
      volunteerAssignments: [],
      status: null,
      familyGuardians: [],
      canRegister: false
    }
  }

  const familyId = guardian.familyId

  const [familyGuardians, registrationStatus, classRegs, volunteerRegs] = await Promise.all([
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
      )),
    db
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
  ])

  const hasRegistrations = classRegs.length > 0 || volunteerRegs.length > 0
  const status = registrationStatus.length > 0 ? registrationStatus[0] : null

  let registrationState = 'not_started'
  if (status) {
    registrationState = status.status
  } else if (hasRegistrations) {
    registrationState = 'completed'
  }

  const normalizedVolunteerRegs = volunteerRegs.map((record) => ({
    ...record,
    schedule: record.schedule || undefined,
    classTeachingRequest: record.classTeachingRequest || undefined,
    classroom: record.classroom || undefined
  }))

  return {
    registrationState,
    hasRegistrations,
    classRegistrations: classRegs,
    volunteerAssignments: normalizedVolunteerRegs,
    status,
    familyGuardians,
    canRegister: registrationState === 'not_started' || registrationState === 'in_progress' || registrationState === 'approved'
  }
}
