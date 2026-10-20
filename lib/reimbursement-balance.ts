import { and, eq, inArray, ne, sql } from 'drizzle-orm'
import { classRegistrations, classTeachingRequests, familyClassCharges, schedules, teacherReimbursements } from '@/lib/schema'
import type { FeeTransaction } from '@/lib/class-fee-ledger'
import { db } from '@/lib/db'

export async function classReimbursementBalance(tx: FeeTransaction | typeof db, classId: string, excludeId?: string) {
  const [charges] = await tx.select({
    count: sql<number>`count(*)`,
    cents: sql<number>`coalesce(sum(${familyClassCharges.amountCents} - ${familyClassCharges.refundedCents}), 0)`,
  })
    .from(familyClassCharges).where(and(eq(familyClassCharges.classTeachingRequestId, classId), eq(familyClassCharges.billingTreatment, 'included')))
  // Classes registered before the charge ledger was introduced (or before it was
  // synchronized) still have valid fees. Match the admin summary's legacy fallback.
  let collectedCents = Number(charges.cents)
  if (Number(charges.count) === 0) {
    const [registrations] = await tx.select({
      cents: sql<number>`round(coalesce(${classTeachingRequests.feeAmount}, 0) * count(distinct ${classRegistrations.id}) * 100)`,
    }).from(classTeachingRequests)
      .leftJoin(schedules, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
      .leftJoin(classRegistrations, and(eq(classRegistrations.scheduleId, schedules.id), eq(classRegistrations.status, 'registered')))
      .where(eq(classTeachingRequests.id, classId))
      .groupBy(classTeachingRequests.id, classTeachingRequests.feeAmount)
    collectedCents = Number(registrations?.cents || 0)
  }
  const [allocated] = await tx.select({ amount: sql<number>`coalesce(sum(${teacherReimbursements.amount}), 0)` })
    .from(teacherReimbursements).where(and(eq(teacherReimbursements.classTeachingRequestId, classId), inArray(teacherReimbursements.status, ['pending', 'approved', 'paid']), excludeId ? ne(teacherReimbursements.id, excludeId) : undefined))
  const collectedAmount = collectedCents / 100
  return {
    collectedAmount,
    availableAmount: Math.max(0, collectedCents - Math.round(Number(allocated.amount) * 100)) / 100,
  }
}

export async function availableClassReimbursement(tx: FeeTransaction | typeof db, classId: string, excludeId?: string) {
  return (await classReimbursementBalance(tx, classId, excludeId)).availableAmount
}
