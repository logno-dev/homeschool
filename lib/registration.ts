import 'server-only'
import { db } from '@/lib/db'
import { getGuardianById, getGuardiansByFamily, getChildrenByFamily } from './database'
import { getRegistrationSchedules } from './registration-schedules'
import {
  classRegistrations,
  volunteerAssignments,
  schedules,
  classTeachingRequests,
  classrooms,
  guardians,
  volunteerJobs
} from '@/lib/schema'
import { and, eq, gt } from 'drizzle-orm'

interface TeachingAssignment {
  guardianId: string
  period: string
  className: string
  volunteerType: string
  guardianName?: string
}

export async function getRegistrationScheduleBundle(sessionId: string, userId?: string) {
  const [scheduleData, familyData] = await Promise.all([
    getRegistrationSchedules(sessionId),
    userId ? getFamilyData(userId) : Promise.resolve({ guardians: [], children: [] })
  ])

  const familyHolds = userId
    ? await getFamilyHoldSelections(sessionId, userId)
    : { registrations: [], volunteerAssignments: [] }

  const teachingAssignments = buildTeachingAssignments(
    scheduleData.schedules,
    familyData.guardians
  )

  return {
    schedules: scheduleData.schedules,
    volunteerJobs: scheduleData.volunteerJobs,
    nonPeriodVolunteerJobs: scheduleData.nonPeriodVolunteerJobs,
    guardians: familyData.guardians,
    children: familyData.children,
    teachingAssignments,
    initialRegistrations: familyHolds.registrations,
    initialVolunteerAssignments: familyHolds.volunteerAssignments
  }
}

async function getFamilyData(userId: string) {
  const guardian = await getGuardianById(userId)
  if (!guardian?.familyId) {
    return { guardians: [], children: [] }
  }

  const [guardians, children] = await Promise.all([
    getGuardiansByFamily(guardian.familyId),
    getChildrenByFamily(guardian.familyId)
  ])

  return { guardians, children }
}

function buildTeachingAssignments(schedules: any[], guardians: any[]): TeachingAssignment[] {
  if (!schedules.length || !guardians.length) return []

  const guardianLookup = guardians.reduce((acc, guardian) => {
    acc[guardian.id] = `${guardian.firstName} ${guardian.lastName}`
    return acc
  }, {} as Record<string, string>)

  const guardianIds = new Set(guardians.map((guardian) => guardian.id))

  return schedules
    .filter((schedule) => guardianIds.has(schedule.teacher.id))
    .map((schedule) => ({
      guardianId: schedule.teacher.id,
      period: schedule.schedule.period,
      className: schedule.classTeachingRequest.className,
      volunteerType: 'teacher',
      guardianName: guardianLookup[schedule.teacher.id] || 'Unknown'
    }))
}

async function getFamilyHoldSelections(sessionId: string, userId: string) {
  const guardian = await getGuardianById(userId)
  if (!guardian?.familyId) {
    return { registrations: [], volunteerAssignments: [] }
  }

  const now = new Date().toISOString()

  const [heldRegistrations, heldVolunteerAssignments] = await Promise.all([
    db
      .select({
        id: classRegistrations.id,
        scheduleId: classRegistrations.scheduleId,
        childId: classRegistrations.childId,
        period: schedules.period,
        className: classTeachingRequests.className,
        teacherFirstName: guardians.firstName,
        teacherLastName: guardians.lastName,
        classroomName: classrooms.name,
        holdExpiresAt: classRegistrations.holdExpiresAt
      })
      .from(classRegistrations)
      .innerJoin(schedules, eq(classRegistrations.scheduleId, schedules.id))
      .innerJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
      .innerJoin(classrooms, eq(schedules.classroomId, classrooms.id))
      .innerJoin(guardians, eq(classTeachingRequests.guardianId, guardians.id))
      .where(and(
        eq(classRegistrations.sessionId, sessionId),
        eq(classRegistrations.familyId, guardian.familyId),
        eq(classRegistrations.status, 'hold'),
        gt(classRegistrations.holdExpiresAt, now)
      )),
    db
      .select({
        id: volunteerAssignments.id,
        guardianId: volunteerAssignments.guardianId,
        period: volunteerAssignments.period,
        volunteerType: volunteerAssignments.volunteerType,
        scheduleId: volunteerAssignments.scheduleId,
        volunteerJobId: volunteerAssignments.volunteerJobId,
        holdExpiresAt: volunteerAssignments.holdExpiresAt,
        guardianFirstName: guardians.firstName,
        guardianLastName: guardians.lastName,
        className: classTeachingRequests.className,
        classroomName: classrooms.name,
        jobTitle: volunteerJobs.title
      })
      .from(volunteerAssignments)
      .innerJoin(guardians, eq(volunteerAssignments.guardianId, guardians.id))
      .leftJoin(schedules, eq(volunteerAssignments.scheduleId, schedules.id))
      .leftJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
      .leftJoin(classrooms, eq(schedules.classroomId, classrooms.id))
      .leftJoin(volunteerJobs, eq(volunteerAssignments.volunteerJobId, volunteerJobs.id))
      .where(and(
        eq(volunteerAssignments.sessionId, sessionId),
        eq(volunteerAssignments.familyId, guardian.familyId),
        eq(volunteerAssignments.status, 'hold'),
        gt(volunteerAssignments.holdExpiresAt, now)
      ))
  ])

  return {
    registrations: heldRegistrations.map((registration) => ({
      scheduleId: registration.scheduleId,
      childId: registration.childId,
      className: registration.className,
      period: registration.period,
      teacher: `${registration.teacherFirstName} ${registration.teacherLastName}`,
      classroom: registration.classroomName,
      status: 'registered' as const,
      holdId: registration.id,
      holdExpiresAt: registration.holdExpiresAt
    })),
    volunteerAssignments: heldVolunteerAssignments.map((assignment) => ({
      guardianId: assignment.guardianId,
      guardianName: `${assignment.guardianFirstName} ${assignment.guardianLastName}`,
      period: assignment.period,
      volunteerType: assignment.volunteerType,
      scheduleId: assignment.scheduleId || undefined,
      volunteerJobId: assignment.volunteerJobId || undefined,
      jobTitle: assignment.jobTitle || undefined,
      className: assignment.className || undefined,
      classroom: assignment.classroomName || undefined,
      holdId: assignment.id,
      holdExpiresAt: assignment.holdExpiresAt
    }))
  }
}
