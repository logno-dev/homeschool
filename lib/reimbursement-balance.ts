import { and, eq, inArray, ne, sql } from 'drizzle-orm'
import { familyClassCharges, teacherReimbursements } from '@/lib/schema'
import type { FeeTransaction } from '@/lib/class-fee-ledger'

export async function availableClassReimbursement(tx: FeeTransaction, classId: string, excludeId?: string) {
  const [charges] = await tx.select({ cents: sql<number>`coalesce(sum(${familyClassCharges.amountCents} - ${familyClassCharges.refundedCents}), 0)` })
    .from(familyClassCharges).where(and(eq(familyClassCharges.classTeachingRequestId, classId), eq(familyClassCharges.billingTreatment, 'included')))
  const [allocated] = await tx.select({ amount: sql<number>`coalesce(sum(${teacherReimbursements.amount}), 0)` })
    .from(teacherReimbursements).where(and(eq(teacherReimbursements.classTeachingRequestId, classId), inArray(teacherReimbursements.status, ['pending', 'paid']), excludeId ? ne(teacherReimbursements.id, excludeId) : undefined))
  return Math.max(0, charges.cents - Math.round(allocated.amount * 100)) / 100
}
