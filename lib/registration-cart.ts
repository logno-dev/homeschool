import 'server-only'

import { and, eq, gt } from 'drizzle-orm'
import { db } from '@/lib/db'
import { getGuardianById } from '@/lib/database'
import {
  children,
  classRegistrations,
  classTeachingRequests,
  guardians,
  schedules,
  sessionClassrooms,
  sessions,
  volunteerAssignments,
  volunteerJobs
} from '@/lib/schema'

export interface FamilyCartSession {
  id: string
  name: string
  classes: Array<{
    id: string
    childName: string
    className: string
    classroomName: string
    period: string
    holdExpiresAt: string | null
  }>
  volunteerAssignments: Array<{
    id: string
    guardianName: string
    title: string
    period: string
    holdExpiresAt: string | null
  }>
}

export async function getFamilyRegistrationCart(userId: string) {
  const guardian = await getGuardianById(userId)
  if (!guardian?.familyId) return { sessions: [], totalItems: 0 }

  const now = new Date().toISOString()
  const [heldClasses, heldVolunteerAssignments] = await Promise.all([
    db
      .select({
        id: classRegistrations.id,
        sessionId: sessions.id,
        sessionName: sessions.name,
        childFirstName: children.firstName,
        childLastName: children.lastName,
        className: classTeachingRequests.className,
        classroomName: sessionClassrooms.name,
        period: schedules.period,
        holdExpiresAt: classRegistrations.holdExpiresAt
      })
      .from(classRegistrations)
      .innerJoin(sessions, eq(classRegistrations.sessionId, sessions.id))
      .innerJoin(children, eq(classRegistrations.childId, children.id))
      .innerJoin(schedules, eq(classRegistrations.scheduleId, schedules.id))
      .innerJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
      .innerJoin(sessionClassrooms, eq(schedules.sessionClassroomId, sessionClassrooms.id))
      .where(and(
        eq(classRegistrations.familyId, guardian.familyId),
        eq(classRegistrations.status, 'hold'),
        gt(classRegistrations.holdExpiresAt, now)
      )),
    db
      .select({
        id: volunteerAssignments.id,
        sessionId: sessions.id,
        sessionName: sessions.name,
        guardianFirstName: guardians.firstName,
        guardianLastName: guardians.lastName,
        className: classTeachingRequests.className,
        jobTitle: volunteerJobs.title,
        period: volunteerAssignments.period,
        volunteerType: volunteerAssignments.volunteerType,
        holdExpiresAt: volunteerAssignments.holdExpiresAt
      })
      .from(volunteerAssignments)
      .innerJoin(sessions, eq(volunteerAssignments.sessionId, sessions.id))
      .innerJoin(guardians, eq(volunteerAssignments.guardianId, guardians.id))
      .leftJoin(schedules, eq(volunteerAssignments.scheduleId, schedules.id))
      .leftJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
      .leftJoin(volunteerJobs, eq(volunteerAssignments.volunteerJobId, volunteerJobs.id))
      .where(and(
        eq(volunteerAssignments.familyId, guardian.familyId),
        eq(volunteerAssignments.status, 'hold'),
        gt(volunteerAssignments.holdExpiresAt, now)
      ))
  ])

  const cartSessions = new Map<string, FamilyCartSession>()
  const getCartSession = (id: string, name: string) => {
    const existing = cartSessions.get(id)
    if (existing) return existing
    const cartSession = { id, name, classes: [], volunteerAssignments: [] }
    cartSessions.set(id, cartSession)
    return cartSession
  }

  heldClasses.forEach((item) => {
    getCartSession(item.sessionId, item.sessionName).classes.push({
      id: item.id,
      childName: `${item.childFirstName} ${item.childLastName}`.trim(),
      className: item.className,
      classroomName: item.classroomName,
      period: item.period,
      holdExpiresAt: item.holdExpiresAt
    })
  })

  heldVolunteerAssignments.forEach((item) => {
    getCartSession(item.sessionId, item.sessionName).volunteerAssignments.push({
      id: item.id,
      guardianName: `${item.guardianFirstName} ${item.guardianLastName}`.trim(),
      title: item.className || item.jobTitle || (item.volunteerType === 'helper' ? 'Class helper' : 'Volunteer assignment'),
      period: item.period,
      holdExpiresAt: item.holdExpiresAt
    })
  })

  return {
    sessions: Array.from(cartSessions.values()),
    totalItems: heldClasses.length + heldVolunteerAssignments.length
  }
}
