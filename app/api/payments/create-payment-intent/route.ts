import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { familySessionFees } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'
import { getGuardianById } from '@/lib/database'
import {
  createPayPalOrder,
  getPayPalMetadata,
  makeFeeMetadata,
  toAmountCents
} from '@/lib/paypal'

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser()

    const { familySessionFeeId, amount, donationAmount = 0 } = await request.json()
    const normalizedDonationAmount = Number(donationAmount) || 0

    // Verify the user has access to this family fee
    const guardian = await getGuardianById(session.user.id)

    if (!guardian) {
      return NextResponse.json({ error: 'Guardian not found' }, { status: 404 })
    }

    const familyFee = await db
      .select()
      .from(familySessionFees)
      .where(and(
        eq(familySessionFees.id, familySessionFeeId),
        eq(familySessionFees.familyId, guardian.familyId)
      ))
      .limit(1)

    if (familyFee.length === 0) {
      return NextResponse.json({ error: 'Fee record not found' }, { status: 404 })
    }

    const fee = familyFee[0]
    const remainingAmount = fee.totalFee - fee.paidAmount

    // Validate amount
    const paymentAmount = Number(amount)
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0 || paymentAmount > remainingAmount) {
      return NextResponse.json({ 
        error: 'Invalid payment amount',
        details: `Amount must be between $0.01 and $${remainingAmount.toFixed(2)}`
      }, { status: 400 })
    }

    if (normalizedDonationAmount < 0) {
      return NextResponse.json({ error: 'Donation amount must be a positive value' }, { status: 400 })
    }

    const resolvedDonationAmount = normalizedDonationAmount
    const paymentAmountCents = toAmountCents(paymentAmount)
    const donationAmountCents = toAmountCents(resolvedDonationAmount)

    const metadata = makeFeeMetadata({
      familySessionFeeId,
      feeAmountCents: paymentAmountCents,
      donationAmountCents
    })

    const orderId = await createPayPalOrder({
      totalAmountCents: paymentAmountCents + donationAmountCents,
      ...metadata,
      description: `DVCLC Session Fee Payment - $${paymentAmount.toFixed(2)}`
    })

    const { isSandbox, clientId } = getPayPalMetadata()

    return NextResponse.json({
      orderId,
      clientId,
      isSandbox,
      environment: isSandbox ? 'sandbox' : 'live',
      expectedFeeAmountCents: paymentAmountCents,
      expectedDonationAmountCents: donationAmountCents
    })

  } catch (error) {
    console.error('Error creating payment intent:', error)
    return NextResponse.json(
      { error: 'Failed to create payment intent' },
      { status: 500 }
    )
  }
}
