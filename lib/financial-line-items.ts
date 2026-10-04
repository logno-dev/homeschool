import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { children, classRegistrations, classTeachingRequests, schedules } from '@/lib/schema'
import type { FamilySessionFee } from '@/lib/schema'

export interface FinancialLineItem {
  description: string
  amount: number
}

// Stored fee totals are authoritative. Current enrollment details are only used
// when they reconcile with the billed class-fee subtotal.
export async function getFinancialLineItems(
  fee: Pick<FamilySessionFee, 'sessionId' | 'familyId' | 'registrationFee' | 'classFees' | 'totalFee'>
): Promise<FinancialLineItem[]> {
  const registrations = await db.select({
    childName: children.firstName,
    className: classTeachingRequests.className,
    amount: classTeachingRequests.feeAmount
  }).from(classRegistrations)
    .innerJoin(children, eq(classRegistrations.childId, children.id))
    .innerJoin(schedules, eq(classRegistrations.scheduleId, schedules.id))
    .innerJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
    .where(and(
      eq(classRegistrations.sessionId, fee.sessionId),
      eq(classRegistrations.familyId, fee.familyId),
      eq(classRegistrations.status, 'registered')
    ))
    .orderBy(asc(children.firstName), asc(classTeachingRequests.className))

  const cents = (amount: number) => Math.round(amount * 100)
  const items: FinancialLineItem[] = [{ description: 'Session registration fee', amount: fee.registrationFee }]
  const classItems = registrations.map((registration) => ({
    description: `${registration.childName} — ${registration.className}`,
    amount: registration.amount || 0
  })).filter((item) => item.amount !== 0)

  if (classItems.reduce((sum, item) => sum + cents(item.amount), 0) === cents(fee.classFees)) {
    items.push(...classItems)
  } else {
    items.push({ description: 'Class fees (recorded subtotal)', amount: fee.classFees })
  }

  const adjustment = cents(fee.totalFee) - items.reduce((sum, item) => sum + cents(item.amount), 0)
  if (adjustment !== 0) items.push({ description: 'Fee adjustment', amount: adjustment / 100 })
  return items
}
