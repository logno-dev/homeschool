import { randomUUID } from 'crypto'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { children, classFeeRefunds, classTeachingRequests, familyClassCharges, familySessionFees, feePayments } from '@/lib/schema'
import { RefundError } from '@/lib/class-fee-refunds'
import { createPaymentSnapshot } from '@/lib/payment-snapshots'

export interface HistoricalRefundInput {
  id: string
  feeId: string
  childId: string
  classId: string
  originalAmount: number
  amount: number
  billTreatment: 'already_removed' | 'still_billed'
  method: 'paypal' | 'cash' | 'check' | 'wire'
  reference: string
  notes: string
  refundedAt: string
}

export async function recordHistoricalClassRefund(input: HistoricalRefundInput, adminId: string) {
  if (!input || !['id', 'feeId', 'childId', 'classId', 'reference', 'notes', 'refundedAt'].every((key) => typeof input[key as keyof HistoricalRefundInput] === 'string')
    || !input.id || !input.notes.trim() || !['already_removed', 'still_billed'].includes(input.billTreatment)
    || !['paypal', 'cash', 'check', 'wire'].includes(input.method)
    || !/^\d{4}-\d{2}-\d{2}$/.test(input.refundedAt) || Number.isNaN(Date.parse(input.refundedAt))
    || new Date(input.refundedAt).toISOString().slice(0, 10) !== input.refundedAt
    || (input.method === 'paypal' && !input.reference.trim())
    || ![input.amount, input.originalAmount].every((amount) => typeof amount === 'number' && Number.isFinite(amount) && amount > 0 && Math.abs(amount * 100 - Math.round(amount * 100)) < 0.00001)
    || input.amount > input.originalAmount) throw new RefundError('Provide the original fee, refund amount, bill treatment, date, and reason. PayPal requires a refund reference.')

  const cents = Math.round(input.amount * 100)
  const originalCents = Math.round(input.originalAmount * 100)
  const chargeId = `historical:${input.feeId}:${input.childId}:${input.classId}`
  const auditNotes = `[Historical class refund; original fee $${input.originalAmount.toFixed(2)}; ${input.billTreatment}] ${input.notes.trim()}`
  return db.transaction(async (tx) => {
    const [duplicate] = await tx.select().from(classFeeRefunds).where(eq(classFeeRefunds.id, input.id))
    if (duplicate) {
      if (duplicate.chargeId !== chargeId || duplicate.amountCents !== cents || duplicate.method !== input.method || duplicate.notes !== auditNotes || duplicate.reference !== (input.reference.trim() || null) || duplicate.refundedAt !== input.refundedAt) throw new RefundError('This request ID was already used for different refund details.')
      return duplicate.id
    }
    const [fee] = await tx.select().from(familySessionFees).where(eq(familySessionFees.id, input.feeId))
    const [child] = await tx.select().from(children).where(eq(children.id, input.childId))
    const [classRecord] = await tx.select().from(classTeachingRequests).where(eq(classTeachingRequests.id, input.classId))
    if (!fee || !child || !classRecord || child.familyId !== fee.familyId || classRecord.sessionId !== fee.sessionId) throw new RefundError('Family, child, class, and session must match.')
    const priorCharges = await tx.select().from(familyClassCharges).where(and(eq(familyClassCharges.familyId, fee.familyId), eq(familyClassCharges.sessionId, fee.sessionId), eq(familyClassCharges.childId, child.id), eq(familyClassCharges.classTeachingRequestId, classRecord.id)))
    const historicalCharge = priorCharges.find((charge) => charge.id === chargeId)
    if (priorCharges.length && (!historicalCharge || priorCharges.length !== 1 || historicalCharge.billingTreatment !== 'already_removed' || input.billTreatment !== 'already_removed')) {
      throw new RefundError('This child/class already has a charge or historical refund record. Use its existing refund review instead of adding another historical record.')
    }
    if (historicalCharge && (historicalCharge.amountCents !== originalCents || cents > historicalCharge.amountCents - historicalCharge.refundedCents)) {
      throw new RefundError('The original fee must match the historical record, and refunds cannot exceed its remaining refundable amount.')
    }
    if (cents > Math.round(fee.paidAmount * 100)) throw new RefundError('Refund exceeds the amount paid toward this bill.')
    const [ledger] = await tx.select({ cents: sql<number>`coalesce(sum(${familyClassCharges.amountCents} - ${familyClassCharges.refundedCents}), 0)` }).from(familyClassCharges)
      .where(and(eq(familyClassCharges.familyId, fee.familyId), eq(familyClassCharges.sessionId, fee.sessionId), eq(familyClassCharges.billingTreatment, 'included')))
    if (input.billTreatment === 'still_billed' && originalCents !== Math.round(fee.classFees * 100) - ledger.cents) {
      throw new RefundError('The original fee must match the bill’s unitemized class-fee amount. Reconcile other missing class charges first.')
    }
    if (input.billTreatment === 'already_removed' && cents > Math.round((fee.paidAmount - fee.totalFee) * 100)) {
      throw new RefundError('The refund exceeds the bill’s available overpayment. Reconcile the historical bill before refunding an already-removed charge.')
    }
    const reference = input.reference.trim() || null
    if (reference) {
      const [prior] = await tx.select().from(classFeeRefunds).where(and(eq(classFeeRefunds.method, input.method), eq(classFeeRefunds.reference, reference)))
      if (prior) throw new RefundError('That refund reference has already been recorded.')
    }
    const removed = input.billTreatment === 'already_removed'
    const now = new Date().toISOString()
    const refundedCents = (historicalCharge?.refundedCents || 0) + cents
    // Keep the original fee for audit, but exclude already-removed charges from
    // billing and reimbursement sums, even when only partially refunded.
    if (historicalCharge) await tx.update(familyClassCharges).set({
      refundedCents, status: refundedCents === originalCents ? 'refunded' : 'retained', updatedAt: now
    }).where(eq(familyClassCharges.id, chargeId))
    else await tx.insert(familyClassCharges).values({
      id: chargeId, sessionId: fee.sessionId, familyId: fee.familyId, childId: child.id,
      classTeachingRequestId: classRecord.id, childName: child.firstName, className: classRecord.className,
      amountCents: originalCents, refundedCents, billingTreatment: removed ? 'already_removed' : 'included',
      status: refundedCents === originalCents ? 'refunded' : 'retained', createdAt: now, updatedAt: now
    })
    const totalFee = (Math.round(fee.totalFee * 100) - (removed ? 0 : cents)) / 100
    const paidAmount = (Math.round(fee.paidAmount * 100) - cents) / 100
    const overpaymentAmount = Math.max(0, Math.round((paidAmount - totalFee) * 100) / 100)
    await tx.update(familySessionFees).set({
      classFees: (Math.round(fee.classFees * 100) - (removed ? 0 : cents)) / 100,
      totalFee, paidAmount, overpaymentAmount, overpaymentStatus: overpaymentAmount > 0 ? 'pending' : 'none',
      status: paidAmount >= totalFee ? 'paid' : paidAmount > 0 ? 'partial' : 'pending', updatedAt: now
    }).where(eq(familySessionFees.id, fee.id))
    const paymentId = randomUUID()
    await tx.insert(feePayments).values({
      id: paymentId, familySessionFeeId: fee.id, familyId: fee.familyId, sessionId: fee.sessionId,
      amount: -input.amount, paymentMethod: `refund_${input.method}`, paymentDate: input.refundedAt,
      notes: `${child.firstName} — ${classRecord.className}: ${auditNotes}${reference ? ` (Refund reference: ${reference})` : ''}`,
      billingSnapshot: await createPaymentSnapshot(tx, fee.id), createdAt: now
    })
    await tx.insert(classFeeRefunds).values({
      id: input.id, chargeId, paymentId, amountCents: cents, method: input.method, reference,
      notes: auditNotes, refundedAt: input.refundedAt, recordedBy: adminId, createdAt: now
    })
    return input.id
  })
}
