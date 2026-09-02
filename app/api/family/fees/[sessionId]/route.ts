import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { getFamilySessionFeeStatus } from '@/lib/fee-calculation'
import { getGuardianById } from '@/lib/database'
import { db } from '@/lib/db'
import { familySessionFees, scholarshipFundTransactions, familyFeeCredits } from '@/lib/schema'
import { and, eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await getAuthenticatedUser()
    const { sessionId } = await params

    // Get guardian info to find family
    const guardian = await getGuardianById(session.user.id)

    if (!guardian) {
      return NextResponse.json({ error: 'User not associated with a family' }, { status: 400 })
    }

    const feeStatus = await getFamilySessionFeeStatus(sessionId, guardian.familyId)

    return NextResponse.json({
      success: true,
      feeStatus
    })

  } catch (error) {
    console.error('Error fetching family fee status:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await getAuthenticatedUser()
    const { sessionId } = await params
    const guardian = await getGuardianById(session.user.id)
    if (!guardian) return NextResponse.json({ error: 'User not associated with a family' }, { status: 400 })

    const { disposition } = await request.json()
    if (!['credit', 'scholarship'].includes(disposition)) {
      return NextResponse.json({ error: 'Invalid overpayment disposition' }, { status: 400 })
    }

    const fee = await db.select().from(familySessionFees).where(and(
      eq(familySessionFees.sessionId, sessionId),
      eq(familySessionFees.familyId, guardian.familyId)
    )).limit(1)
    if (!fee[0]) return NextResponse.json({ error: 'Fee record not found' }, { status: 404 })

    const amount = Math.max(0, fee[0].paidAmount - fee[0].totalFee)
    if (amount <= 0 || fee[0].overpaymentStatus !== 'pending') {
      return NextResponse.json({ error: 'No unresolved overpayment is available' }, { status: 400 })
    }

    const now = new Date().toISOString()
    await db.transaction(async (tx) => {
      if (disposition === 'credit') {
        await tx.insert(familyFeeCredits).values({
          id: randomUUID(),
          familyId: guardian.familyId,
          sourceFeeId: fee[0].id,
          amount,
          notes: `Overpayment credit from session ${sessionId}`,
          createdAt: now,
          updatedAt: now
        })
      } else {
        await tx.insert(scholarshipFundTransactions).values({
          id: randomUUID(),
          amount,
          transactionType: 'donation',
          source: 'family_overpayment',
          familyId: guardian.familyId,
          sessionId,
          notes: 'Family overpayment donated to scholarship fund',
          createdAt: now
        })
      }
      await tx.update(familySessionFees).set({
        paidAmount: fee[0].totalFee,
        status: 'paid',
        overpaymentAmount: 0,
        overpaymentStatus: disposition,
        overpaymentResolvedAt: now,
        overpaymentResolutionNotes: disposition === 'credit' ? 'Held as account credit' : 'Donated to scholarship fund',
        updatedAt: now
      }).where(eq(familySessionFees.id, fee[0].id))
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error resolving family overpayment:', error)
    return NextResponse.json({ error: 'Failed to resolve overpayment' }, { status: 500 })
  }
}
