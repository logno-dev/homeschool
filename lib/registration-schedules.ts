import 'server-only'
import { db } from '@/lib/db'
import {
  schedules,
  classTeachingRequests,
  guardians,
  classrooms,
  classRegistrations,
  children,
  volunteerJobs,
  sessionVolunteerJobs,
  volunteerAssignments
} from '@/lib/schema'
import { and, eq } from 'drizzle-orm'

export async function getRegistrationSchedules(sessionId: string) {
  const [publishedSchedules, registrationData, volunteerData, periodBasedJobs, nonPeriodJobs] = await Promise.all([
    db
      .select({
        schedule: schedules,
        classTeachingRequest: classTeachingRequests,
        classroom: classrooms,
        teacher: {
          id: guardians.id,
          firstName: guardians.firstName,
          lastName: guardians.lastName
        }
      })
      .from(schedules)
      .innerJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
      .innerJoin(classrooms, eq(schedules.classroomId, classrooms.id))
      .innerJoin(guardians, eq(classTeachingRequests.guardianId, guardians.id))
      .where(and(
        eq(schedules.sessionId, sessionId),
        eq(schedules.status, 'published')
      )),

    db
      .select({
        scheduleId: classRegistrations.scheduleId,
        child: {
          id: children.id,
          firstName: children.firstName,
          lastName: children.lastName,
          grade: children.grade
        }
      })
      .from(classRegistrations)
      .innerJoin(children, eq(classRegistrations.childId, children.id))
      .where(and(
        eq(classRegistrations.sessionId, sessionId),
        eq(classRegistrations.status, 'registered')
      )),

    db
      .select({
        scheduleId: volunteerAssignments.scheduleId,
        guardian: {
          id: guardians.id,
          firstName: guardians.firstName,
          lastName: guardians.lastName
        },
        volunteerType: volunteerAssignments.volunteerType
      })
      .from(volunteerAssignments)
      .innerJoin(guardians, eq(volunteerAssignments.guardianId, guardians.id))
      .where(eq(volunteerAssignments.sessionId, sessionId)),

    db
      .select({
        id: volunteerJobs.id,
        sessionVolunteerJobId: sessionVolunteerJobs.id,
        title: volunteerJobs.title,
        description: volunteerJobs.description,
        quantityAvailable: sessionVolunteerJobs.quantityAvailable,
        jobType: volunteerJobs.jobType,
        isActive: sessionVolunteerJobs.isActive
      })
      .from(sessionVolunteerJobs)
      .innerJoin(volunteerJobs, eq(sessionVolunteerJobs.volunteerJobId, volunteerJobs.id))
      .where(and(
        eq(sessionVolunteerJobs.sessionId, sessionId),
        eq(volunteerJobs.jobType, 'period_based'),
        eq(sessionVolunteerJobs.isActive, true)
      )),

    db
      .select({
        id: volunteerJobs.id,
        sessionVolunteerJobId: sessionVolunteerJobs.id,
        title: volunteerJobs.title,
        description: volunteerJobs.description,
        quantityAvailable: sessionVolunteerJobs.quantityAvailable,
        jobType: volunteerJobs.jobType,
        isActive: sessionVolunteerJobs.isActive
      })
      .from(sessionVolunteerJobs)
      .innerJoin(volunteerJobs, eq(sessionVolunteerJobs.volunteerJobId, volunteerJobs.id))
      .where(and(
        eq(sessionVolunteerJobs.sessionId, sessionId),
        eq(volunteerJobs.jobType, 'non_period'),
        eq(sessionVolunteerJobs.isActive, true)
      ))
  ])

  const registrationCountMap: Record<string, number> = {}
  const rosterMap: Record<string, Array<{ id: string; firstName: string; lastName: string; grade: string }>> = {}

  registrationData.forEach((item) => {
    const scheduleId = item.scheduleId
    if (scheduleId) {
      registrationCountMap[scheduleId] = (registrationCountMap[scheduleId] || 0) + 1

      if (!rosterMap[scheduleId]) {
        rosterMap[scheduleId] = []
      }
      rosterMap[scheduleId].push(item.child)
    }
  })

  const volunteersMap: Record<string, Array<{ guardian: { id: string; firstName: string; lastName: string }; volunteerType: string }>> = {}

  volunteerData.forEach((item) => {
    const scheduleId = item.scheduleId
    if (scheduleId) {
      if (!volunteersMap[scheduleId]) {
        volunteersMap[scheduleId] = []
      }
      volunteersMap[scheduleId].push({
        guardian: item.guardian,
        volunteerType: item.volunteerType
      })
    }
  })

  const enhancedSchedules = publishedSchedules.map((item) => {
    const currentHelpers = volunteersMap[item.schedule.id]?.filter((v) => v.volunteerType === 'helper').length || 0
    return {
      ...item,
      currentRegistrations: registrationCountMap[item.schedule.id] || 0,
      availableSpots: item.classTeachingRequest.maxStudents - (registrationCountMap[item.schedule.id] || 0),
      helpersAvailable: item.classTeachingRequest.helpersNeeded - currentHelpers,
      roster: rosterMap[item.schedule.id] || [],
      volunteers: volunteersMap[item.schedule.id] || []
    }
  })

  return {
    schedules: enhancedSchedules,
    volunteerJobs: periodBasedJobs,
    nonPeriodVolunteerJobs: nonPeriodJobs
  }
}
