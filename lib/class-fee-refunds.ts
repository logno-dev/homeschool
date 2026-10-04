import { randomUUID } from 'crypto'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { classFeeRefunds, familyClassCharges, familySessionFees, feePayments } from '@/lib/schema'

export class RefundError extends Error {}
export interface RefundInput {
  id: string
  chargeId: string
  amount: number
  method: 'paypal' | 'cash' | 'check' | 'wire' | 'waiver' | 'retain'
  reference: string
  notes: string
  refundedAt: string
}

export async function recordClassFeeRefund(input: RefundInput, recordedBy: string) {
  if (!input || typeof input.id !== 'string' || typeof input.chargeId !== 'string'
    || typeof input.amount !== 'number' || typeof input.method !== 'string'
    || typeof input.reference !== 'string' || typeof input.notes !== 'string' || typeof input.refundedAt !== 'string') {
    throw new RefundError('Invalid refund details.')
  }
  const amountCents = Math.round(input.amount * 100)
  if (!input.id || !input.chargeId || !Number.isFinite(input.amount)
    || (input.method === 'retain' ? amountCents !== 0 : amountCents <= 0)
    || Math.abs(input.amount * 100 - amountCents) > 0.00001
    || !['paypal', 'cash', 'check', 'wire', 'waiver', 'retain'].includes(input.method)
    || !input.notes?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(input.refundedAt)
    || Number.isNaN(Date.parse(input.refundedAt))
    || new Date(input.refundedAt).toISOString().slice(0, 10) !== input.refundedAt
    || (input.method === 'paypal' && !input.reference?.trim())) {
    throw new RefundError('Provide a valid amount, method, date, and reason. PayPal refunds require the refund reference.')
  }

  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(classFeeRefunds).where(eq(classFeeRefunds.id, input.id))
    if (existing) {
      if (existing.chargeId !== input.chargeId || existing.amountCents !== amountCents || existing.method !== input.method
        || existing.reference !== (input.reference?.trim() || null) || existing.notes !== input.notes.trim() || existing.refundedAt !== input.refundedAt) {
        throw new RefundError('This request ID was already used for a different refund.')
      }
      return existing.id
    }
    const [charge] = await tx.select().from(familyClassCharges).where(eq(familyClassCharges.id, input.chargeId))
    if (!charge || charge.status === 'active') throw new RefundError('Only dropped-class charges can be reviewed here.')
    if (amountCents > charge.amountCents - charge.refundedCents) throw new RefundError('Refund exceeds the remaining class charge.')
    if (input.method === 'retain' && charge.status !== 'review') throw new RefundError('This charge has already been reviewed.')

    const [fee] = await tx.select().from(familySessionFees).where(and(eq(familySessionFees.familyId, charge.familyId), eq(familySessionFees.sessionId, charge.sessionId)))
    if (!fee) throw new RefundError('No family session bill exists for this charge.')
    const classCents = Math.round(fee.classFees * 100)
    const paidCents = Math.round(fee.paidAmount * 100)
    const totalCents = Math.round(fee.totalFee * 100)
    const [ledger] = await tx.select({ cents: sql<number>`coalesce(sum(${familyClassCharges.amountCents} - ${familyClassCharges.refundedCents}), 0)` })
      .from(familyClassCharges).where(and(eq(familyClassCharges.familyId, charge.familyId), eq(familyClassCharges.sessionId, charge.sessionId)))
    if (ledger.cents !== classCents) throw new RefundError('The recorded bill and class-charge ledger differ. Reconcile the family bill before recording a refund.')
    const cashRefund = !['retain', 'waiver'].includes(input.method)
    if (amountCents > classCents || amountCents > totalCents) throw new RefundError('The bill must be reconciled before recording this refund.')
    if (cashRefund && amountCents > paidCents) throw new RefundError('Refund exceeds the amount currently paid toward this bill. Use a fee waiver for unpaid charges.')
    if (input.method === 'waiver' && amountCents > Math.max(0, totalCents - paidCents)) throw new RefundError('A waiver can only remove unpaid charges. Record a refund for money returned.')
    const reference = input.reference?.trim() || null
    if (reference) {
      const [duplicate] = await tx.select().from(classFeeRefunds).where(and(eq(classFeeRefunds.method, input.method), eq(classFeeRefunds.reference, reference)))
      if (duplicate) throw new RefundError('That refund reference has already been recorded.')
    }
    const now = new Date().toISOString()
    const paymentId = cashRefund ? randomUUID() : null
    if (paymentId) {
      await tx.insert(feePayments).values({
        id: paymentId, familySessionFeeId: fee.id, familyId: charge.familyId, sessionId: charge.sessionId,
        amount: -amountCents / 100, paymentMethod: `refund_${input.method}`, paymentDate: input.refundedAt,
        notes: `${charge.childName} — ${charge.className}: ${input.notes.trim()}${reference ? ` (Refund reference: ${reference})` : ''}`,
        createdAt: now
      })
    }
    await tx.insert(classFeeRefunds).values({
      id: input.id, chargeId: charge.id, paymentId, amountCents, method: input.method,
      reference, notes: input.notes.trim(), recordedBy, refundedAt: input.refundedAt, createdAt: now
    })
    await tx.update(familyClassCharges).set({
      refundedCents: charge.refundedCents + amountCents,
      status: charge.refundedCents + amountCents === charge.amountCents ? 'refunded' : 'retained', updatedAt: now
    }).where(eq(familyClassCharges.id, charge.id))

    const total = (totalCents - amountCents) / 100
    const paid = (paidCents - (cashRefund ? amountCents : 0)) / 100
    const overpaymentAmount = Math.max(0, Math.round((paid - total) * 100) / 100)
    await tx.update(familySessionFees).set({
      classFees: (classCents - amountCents) / 100, totalFee: total, paidAmount: paid,
      status: paid >= total ? 'paid' : paid > 0 ? 'partial' : 'pending',
      overpaymentAmount, overpaymentStatus: overpaymentAmount > 0 ? 'pending' : 'none',
      updatedAt: now
    }).where(eq(familySessionFees.id, fee.id))
    return input.id
  })
}
