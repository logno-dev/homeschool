import { and, eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { db } from '@/lib/db'
import { children, classRegistrations, classTeachingRequests, familyClassCharges, schedules } from '@/lib/schema'

export type FeeTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

export async function syncClassCharges(sessionId: string, familyId: string, tx: FeeTransaction) {
  const registrations = await tx.select({
    childId: classRegistrations.childId,
    childName: children.firstName,
    classId: classTeachingRequests.id,
    className: classTeachingRequests.className,
    amount: classTeachingRequests.feeAmount
  }).from(classRegistrations)
    .innerJoin(children, eq(classRegistrations.childId, children.id))
    .innerJoin(schedules, eq(classRegistrations.scheduleId, schedules.id))
    .innerJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
    .where(and(eq(classRegistrations.sessionId, sessionId), eq(classRegistrations.familyId, familyId), eq(classRegistrations.status, 'registered')))
  const now = new Date().toISOString()
  const existing = await tx.select().from(familyClassCharges).where(and(eq(familyClassCharges.sessionId, sessionId), eq(familyClassCharges.familyId, familyId)))
  const active = new Set<string>()
  for (const registration of registrations) {
    const id = `${sessionId}:${familyId}:${registration.childId}:${registration.classId}`
    if (active.has(id)) continue
    active.add(id)
    const previous = existing.filter((charge) => charge.childId === registration.childId && charge.classTeachingRequestId === registration.classId)
    if (previous.length) {
      // A return after a refund is a new charge; credit any retained amount
      // toward it rather than silently granting a permanent discount.
      if (previous.every((charge) => charge.status !== 'active')) {
        const retained = previous.reduce((sum, charge) => sum + charge.amountCents - charge.refundedCents, 0)
        const extra = Math.max(0, Math.round((registration.amount || 0) * 100) - retained)
        if (extra > 0) await tx.insert(familyClassCharges).values({
          id: randomUUID(), sessionId, familyId, childId: registration.childId,
          classTeachingRequestId: registration.classId, childName: registration.childName,
          className: registration.className, amountCents: extra, createdAt: now, updatedAt: now
        })
      }
      continue
    }
    await tx.insert(familyClassCharges).values({
      id, sessionId, familyId, childId: registration.childId,
      classTeachingRequestId: registration.classId, childName: registration.childName,
      className: registration.className, amountCents: Math.round((registration.amount || 0) * 100),
      createdAt: now, updatedAt: now
    }).onConflictDoNothing()
  }
  const charges = await tx.select().from(familyClassCharges).where(and(eq(familyClassCharges.sessionId, sessionId), eq(familyClassCharges.familyId, familyId)))
  for (const charge of charges) {
    const key = `${sessionId}:${familyId}:${charge.childId}:${charge.classTeachingRequestId}`
    const status = active.has(key) ? 'active' : charge.status === 'active' ? 'review' : charge.status
    if (status !== charge.status) await tx.update(familyClassCharges).set({ status, updatedAt: now }).where(eq(familyClassCharges.id, charge.id))
  }
  return charges.reduce((sum, charge) => sum + charge.amountCents - charge.refundedCents, 0) / 100
}
