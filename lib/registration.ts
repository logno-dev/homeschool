import 'server-only'
import { getGuardianById, getGuardiansByFamily, getChildrenByFamily } from './database'
import { getRegistrationSchedules } from './registration-schedules'

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
    teachingAssignments
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
