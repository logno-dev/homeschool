import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { children, classRegistrations, classTeachingRequests, familyClassCharges, schedules, sessionFeeConfigs } from '@/lib/schema'
import type { FamilySessionFee } from '@/lib/schema'
import { calculateFeeFromRules, parseStoredSessionFeeRules } from '@/lib/session-fee-rules'

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
    childId: classRegistrations.childId,
    registrationFeeExempt: classTeachingRequests.registrationFeeExempt,
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
  const [config] = await db.select().from(sessionFeeConfigs)
    .where(eq(sessionFeeConfigs.sessionId, fee.sessionId)).limit(1)
  const childCount = new Set(registrations.filter((row) => !row.registrationFeeExempt).map((row) => row.childId)).size
  const exemptCount = new Set(registrations.map((row) => row.childId)).size - childCount
  const countLabel = `${childCount} ${childCount === 1 ? 'child' : 'children'}`
  let registrationDescription = 'Session registration fee — recorded amount; pricing details unavailable'

  if (config) {
    const rules = parseStoredSessionFeeRules(config.pricingRules)
    const ruleFee = calculateFeeFromRules(childCount, rules)
    const calculatedFee = ruleFee ?? (childCount > 0 ? config.firstChildFee + (childCount - 1) * config.additionalChildFee : 0)
    if (cents(calculatedFee) === cents(fee.registrationFee)) {
      const rule = rules.find((item) => childCount >= item.minChildren && (item.maxChildren === null || childCount <= item.maxChildren))
      if (childCount === 0) {
        registrationDescription = 'Session registration fee — no children subject to registration fees'
      } else if (rule) {
        const tier = rule.maxChildren === rule.minChildren
          ? `${rule.minChildren}-child`
          : rule.maxChildren === null ? `${rule.minChildren}+ children` : `${rule.minChildren}–${rule.maxChildren} children`
        registrationDescription = `Session registration fee — ${countLabel}; ${tier} family rate`
      } else {
        const additional = childCount - 1
        registrationDescription = `Session registration fee — ${countLabel}; first child $${config.firstChildFee.toFixed(2)}`
          + (additional > 0 ? ` + ${additional} additional ${additional === 1 ? 'child' : 'children'} × $${config.additionalChildFee.toFixed(2)}` : '')
      }
      if (exemptCount > 0) registrationDescription += ` (${exemptCount} ${exemptCount === 1 ? 'child' : 'children'} enrolled only in registration-exempt classes excluded)`
    } else {
      registrationDescription = 'Session registration fee — recorded amount; current enrollment/pricing no longer matches this charge'
    }
  }

  const items: FinancialLineItem[] = [{ description: registrationDescription, amount: fee.registrationFee }]
  const charges = await db.select().from(familyClassCharges)
    .where(and(eq(familyClassCharges.sessionId, fee.sessionId), eq(familyClassCharges.familyId, fee.familyId)))
    .orderBy(asc(familyClassCharges.childName), asc(familyClassCharges.className))
  const classItems = charges.length ? charges.map((charge) => ({
    description: `${charge.childName} — ${charge.className}${charge.status === 'review' ? ' (dropped; refund review pending)' : charge.status === 'retained' ? ' (dropped; retained fee)' : ''}${charge.refundedCents ? ` ($${(charge.refundedCents / 100).toFixed(2)} refunded/waived)` : ''}`,
    amount: (charge.amountCents - charge.refundedCents) / 100
  })) : registrations.map((registration) => ({
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
