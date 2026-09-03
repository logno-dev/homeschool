import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { getGuardianById } from '@/lib/database'
import { db } from '@/lib/db'
import { familyFeeCredits, familySessionFees, feePayments } from '@/lib/schema'

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser()
    const guardian = await getGuardianById(session.user.id)
    if (!guardian) return NextResponse.json({ error: 'Guardian not found' }, { status: 404 })

    const { familySessionFeeId, amount } = await request.json()
    const requestedAmount = Number(amount)
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      return NextResponse.json({ error: 'Invalid credit amount' }, { status: 400 })
    }

    const feeRows = await db.select().from(familySessionFees).where(and(
      eq(familySessionFees.id, familySessionFeeId),
      eq(familySessionFees.familyId, guardian.familyId)
    )).limit(1)
    const fee = feeRows[0]
    if (!fee) return NextResponse.json({ error: 'Fee record not found' }, { status: 404 })

    const amountToApply = Math.round(requestedAmount * 100) / 100
    if (amountToApply > fee.totalFee - fee.paidAmount + 0.005) {
      return NextResponse.json({ error: 'Credit exceeds the remaining balance' }, { status: 400 })
    }

    await db.transaction(async (tx) => {
      let remaining = amountToApply
      const credits = await tx.select().from(familyFeeCredits).where(and(
        eq(familyFeeCredits.familyId, guardian.familyId),
        eq(familyFeeCredits.status, 'available')
      ))
      for (const credit of credits) {
        if (remaining <= 0) break
        const applied = Math.min(credit.amount, remaining)
        await tx.update(familyFeeCredits).set({
          amount: credit.amount - applied,
          status: credit.amount - applied <= 0.005 ? 'applied' : 'available',
          updatedAt: new Date().toISOString()
        }).where(eq(familyFeeCredits.id, credit.id))
        remaining -= applied
      }
      if (remaining > 0.005) throw new Error('Insufficient account credit')

      await tx.update(familySessionFees).set({
        paidAmount: fee.paidAmount + amountToApply,
        status: fee.paidAmount + amountToApply >= fee.totalFee ? 'paid' : 'partial',
        updatedAt: new Date().toISOString()
      }).where(eq(familySessionFees.id, fee.id))

      await tx.insert(feePayments).values({
        id: randomUUID(),
        familySessionFeeId: fee.id,
        familyId: fee.familyId,
        sessionId: fee.sessionId,
        amount: amountToApply,
        paymentDate: new Date().toISOString(),
        paymentMethod: 'credit',
        notes: 'Applied available account credit'
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error applying account credit:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to apply account credit' }, { status: 500 })
  }
}
