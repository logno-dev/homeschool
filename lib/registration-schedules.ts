import 'server-only'
import { db } from '@/lib/db'
import { ensureSessionClassrooms, ensureSessionVolunteerJobs } from '@/lib/database'
import {
  schedules,
  classTeachingRequests,
  guardians,
  sessionClassrooms,
  classRegistrations,
  children,
  volunteerJobs,
  sessionVolunteerJobs,
  volunteerAssignments
} from '@/lib/schema'
import { and, eq, or, gt, inArray, isNotNull } from 'drizzle-orm'

export async function getRegistrationSchedules(sessionId: string) {
  await ensureSessionClassrooms(sessionId)
  await ensureSessionVolunteerJobs(sessionId)
  const now = new Date().toISOString()
  const [publishedSchedules, registrationData, volunteerData, volunteerJobAssignments, sessionJobsRaw] = await Promise.all([
    db
      .select({
        schedule: schedules,
        classTeachingRequest: classTeachingRequests,
        classroom: sessionClassrooms,
        teacher: {
          id: guardians.id,
          firstName: guardians.firstName,
          lastName: guardians.lastName
        }
      })
      .from(schedules)
      .innerJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
      .innerJoin(sessionClassrooms, eq(schedules.sessionClassroomId, sessionClassrooms.id))
      .innerJoin(guardians, eq(classTeachingRequests.guardianId, guardians.id))
      .where(and(
        eq(schedules.sessionId, sessionId),
        eq(schedules.status, 'published')
      )),

    db
      .select({
        scheduleId: classRegistrations.scheduleId,
        status: classRegistrations.status,
        holdExpiresAt: classRegistrations.holdExpiresAt,
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
        or(
          inArray(classRegistrations.status, ['registered', 'pending']),
          and(eq(classRegistrations.status, 'hold'), gt(classRegistrations.holdExpiresAt, now))
        )
      )),

    db
      .select({
        scheduleId: volunteerAssignments.scheduleId,
        status: volunteerAssignments.status,
        holdExpiresAt: volunteerAssignments.holdExpiresAt,
        guardian: {
          id: guardians.id,
          firstName: guardians.firstName,
          lastName: guardians.lastName
        },
        volunteerType: volunteerAssignments.volunteerType
      })
      .from(volunteerAssignments)
      .innerJoin(guardians, eq(volunteerAssignments.guardianId, guardians.id))
      .where(and(
        eq(volunteerAssignments.sessionId, sessionId),
        or(
          inArray(volunteerAssignments.status, ['assigned', 'pending']),
          and(eq(volunteerAssignments.status, 'hold'), gt(volunteerAssignments.holdExpiresAt, now))
        )
      )),

    db
      .select({
        volunteerJobId: volunteerAssignments.volunteerJobId,
        period: volunteerAssignments.period,
        status: volunteerAssignments.status,
        holdExpiresAt: volunteerAssignments.holdExpiresAt
      })
      .from(volunteerAssignments)
      .where(and(
        eq(volunteerAssignments.sessionId, sessionId),
        isNotNull(volunteerAssignments.volunteerJobId),
        or(
          inArray(volunteerAssignments.status, ['assigned', 'pending']),
          and(eq(volunteerAssignments.status, 'hold'), gt(volunteerAssignments.holdExpiresAt, now))
        )
      )),

    db
      .select({
        id: volunteerJobs.id,
        sessionVolunteerJobId: sessionVolunteerJobs.id,
        title: volunteerJobs.title,
        description: volunteerJobs.description,
        quantityAvailable: sessionVolunteerJobs.quantityAvailable,
        jobType: sessionVolunteerJobs.jobType,
        fallbackJobType: volunteerJobs.jobType,
        isActive: sessionVolunteerJobs.isActive
      })
      .from(sessionVolunteerJobs)
      .innerJoin(volunteerJobs, eq(sessionVolunteerJobs.volunteerJobId, volunteerJobs.id))
      .where(and(
        eq(sessionVolunteerJobs.sessionId, sessionId),
        eq(sessionVolunteerJobs.isActive, true)
      ))
  ])

  const normalizeJobType = (value?: string | null) => {
    if (!value) return 'non_period'
    if (value === 'non-period') return 'non_period'
    if (value === 'period') return 'period_based'
    return value
  }

  const sessionJobs = (sessionJobsRaw as unknown) as Array<{
    id: string
    sessionVolunteerJobId: string
    title: string
    description: string
    quantityAvailable: number
    jobType: string | null
    fallbackJobType: string | null
    isActive: boolean
  }>

  const periodBasedJobs = sessionJobs
    .filter((job) => normalizeJobType(job.jobType || job.fallbackJobType) === 'period_based')
    .map((job) => ({
      ...job,
      jobType: normalizeJobType(job.jobType || job.fallbackJobType)
    }))

  const nonPeriodJobs = sessionJobs
    .filter((job) => normalizeJobType(job.jobType || job.fallbackJobType) === 'non_period')
    .map((job) => ({
      ...job,
      jobType: normalizeJobType(job.jobType || job.fallbackJobType)
    }))

  if (process.env.NODE_ENV !== 'production') {
    console.log('Registration job split', {
      sessionId,
      sessionJobs: sessionJobs.length,
      periodBased: periodBasedJobs.length,
      nonPeriod: nonPeriodJobs.length
    })
  }

  const registrationCountMap: Record<string, number> = {}
  const rosterMap: Record<string, Array<{ id: string; firstName: string; lastName: string; grade: string; status: string }>> = {}
  const rosterByScheduleAndChild = new Map<string, { id: string; firstName: string; lastName: string; grade: string; status: string }>()
  const statusPriority: Record<string, number> = { hold: 1, pending: 2, registered: 3 }

  registrationData.forEach((item) => {
    const scheduleId = item.scheduleId
    if (scheduleId) {
      const rosterEntry = {
        ...item.child,
        status: item.status
      }
      const key = `${scheduleId}:${item.child.id}`
      const existing = rosterByScheduleAndChild.get(key)
      if (!existing || (statusPriority[item.status] || 0) > (statusPriority[existing.status] || 0)) {
        rosterByScheduleAndChild.set(key, rosterEntry)
      }
    }
  })

  rosterByScheduleAndChild.forEach((student, key) => {
    const scheduleId = key.slice(0, key.lastIndexOf(':'))
    registrationCountMap[scheduleId] = (registrationCountMap[scheduleId] || 0) + 1
    if (!rosterMap[scheduleId]) rosterMap[scheduleId] = []
    rosterMap[scheduleId].push(student)
  })

  const volunteersMap: Record<string, Array<{ guardian: { id: string; firstName: string; lastName: string }; volunteerType: string }>> = {}
  const volunteerCountMap: Record<string, Array<string>> = {}

  volunteerData.forEach((item) => {
    const scheduleId = item.scheduleId
    if (!scheduleId) return

    if (!volunteerCountMap[scheduleId]) {
      volunteerCountMap[scheduleId] = []
    }
    volunteerCountMap[scheduleId].push(item.volunteerType)

    if (item.status === 'assigned') {
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
    const currentHelpers = volunteerCountMap[item.schedule.id]?.filter((v) => v === 'helper').length || 0
    return {
      ...item,
      currentRegistrations: registrationCountMap[item.schedule.id] || 0,
      availableSpots: item.classTeachingRequest.maxStudents - (registrationCountMap[item.schedule.id] || 0),
      helpersAvailable: item.classTeachingRequest.helpersNeeded - currentHelpers,
      roster: rosterMap[item.schedule.id] || [],
      volunteers: volunteersMap[item.schedule.id] || []
    }
  })

  const volunteerJobAssignmentsList = (volunteerJobAssignments as unknown) as Array<{
    volunteerJobId: string | null
    period: string | null
    status: string
    holdExpiresAt: string | null
  }>

  const normalizePeriod = (period: string | null) => {
    if (!period) return null
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
      case 'non_period':
        return 'non_period'
      case 'lunch':
        return 'lunch'
      default:
        return period
    }
  }

  const allSessionJobs = [...periodBasedJobs, ...nonPeriodJobs] as Array<{
    id: string
    sessionVolunteerJobId: string
  }>

  const jobIdToSessionIds = allSessionJobs.reduce((acc, job) => {
    if (!acc[job.id]) {
      acc[job.id] = []
    }
    acc[job.id].push(job.sessionVolunteerJobId)
    return acc
  }, {} as Record<string, string[]>)

  const volunteerJobAssignmentCounts = volunteerJobAssignmentsList.reduce((acc, assignment) => {
    const jobId = assignment.volunteerJobId
    const period = normalizePeriod(assignment.period)
    if (!jobId || !period) return acc

    const sessionJobIds = jobIdToSessionIds[jobId] || []
    sessionJobIds.forEach((sessionJobId) => {
      const key = `${sessionJobId}:${period}`
      acc[key] = (acc[key] || 0) + 1
    })

    return acc
  }, {} as Record<string, number>)

  return {
    schedules: enhancedSchedules,
    volunteerJobs: periodBasedJobs,
    nonPeriodVolunteerJobs: nonPeriodJobs,
    volunteerJobAssignmentCounts
  }
}
