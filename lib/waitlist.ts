import 'server-only'

import { randomUUID } from 'crypto'
import { and, eq, gt, inArray, max, or, sql } from 'drizzle-orm'
import type { FeeTransaction } from '@/lib/class-fee-ledger'
import { classRegistrations, classTeachingRequests, schedules, waitlistVacancyFlags } from '@/lib/schema'

export async function getNextWaitlistRank(tx: FeeTransaction, scheduleId: string) {
  const [row] = await tx.select({ rank: max(classRegistrations.waitlistRank) }).from(classRegistrations).where(eq(classRegistrations.scheduleId, scheduleId))
  return (row.rank || 0) + 1
}

export async function createWaitlistVacancyFlag(tx: FeeTransaction, scheduleId: string, triggerRegistrationId: string | null, adminId: string) {
  const now = new Date().toISOString()
  const [classRow] = await tx.select({ sessionId: schedules.sessionId, maxStudents: classTeachingRequests.maxStudents }).from(schedules)
    .innerJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
    .where(eq(schedules.id, scheduleId)).limit(1)
  if (!classRow) return null

  const [occupancy, waitlist, existing] = await Promise.all([
    tx.select({ count: sql<number>`count(*)` }).from(classRegistrations).where(and(eq(classRegistrations.scheduleId, scheduleId), or(inArray(classRegistrations.status, ['registered', 'pending']), and(eq(classRegistrations.status, 'hold'), gt(classRegistrations.holdExpiresAt, now))))).then((rows) => rows[0]?.count || 0),
    tx.select({ count: sql<number>`count(*)` }).from(classRegistrations).where(and(eq(classRegistrations.scheduleId, scheduleId), eq(classRegistrations.status, 'waitlisted'))).then((rows) => rows[0]?.count || 0),
    tx.select({ id: waitlistVacancyFlags.id }).from(waitlistVacancyFlags).where(and(eq(waitlistVacancyFlags.scheduleId, scheduleId), eq(waitlistVacancyFlags.status, 'open'))).limit(1).then((rows) => rows[0]),
  ])
  const openSlots = Math.max(0, classRow.maxStudents - occupancy)
  if (!openSlots || !waitlist || existing) return null
  const id = randomUUID()
  await tx.insert(waitlistVacancyFlags).values({ id, sessionId: classRow.sessionId, scheduleId, triggerRegistrationId, triggeredBy: adminId, openSlotsAtCreation: openSlots, waitlistCountAtCreation: waitlist })
  return { id, openSlots, waitlistCount: waitlist }
}
