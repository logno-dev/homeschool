import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { familySessionFees, guardians } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'

// Mock Stripe Payment Intent creation
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser()

    const { familySessionFeeId, amount } = await request.json()

    // Verify the user has access to this family fee
    const guardian = await db
      .select()
      .from(guardians)
      .where(eq(guardians.id, session.user.id))
      .limit(1)

    if (guardian.length === 0) {
      return NextResponse.json({ error: 'Guardian not found' }, { status: 404 })
    }

    const familyFee = await db
      .select()
      .from(familySessionFees)
      .where(and(
        eq(familySessionFees.id, familySessionFeeId),
        eq(familySessionFees.familyId, guardian[0].familyId)
      ))
      .limit(1)

    if (familyFee.length === 0) {
      return NextResponse.json({ error: 'Fee record not found' }, { status: 404 })
    }

    const fee = familyFee[0]
    const remainingAmount = fee.totalFee - fee.paidAmount

    // Validate amount
    if (amount <= 0 || amount > remainingAmount) {
      return NextResponse.json({ 
        error: 'Invalid payment amount',
        details: `Amount must be between $0.01 and $${remainingAmount.toFixed(2)}`
      }, { status: 400 })
    }

    // Create mock payment intent (mimics Stripe's structure)
    const paymentIntentId = `pi_mock_${randomUUID().replace(/-/g, '')}`
    const clientSecret = `${paymentIntentId}_secret_${randomUUID().replace(/-/g, '')}`

    // In a real implementation, this would be stored in Stripe
    // For now, we'll store it temporarily in memory or could add to database
    const mockPaymentIntent = {
      id: paymentIntentId,
      object: 'payment_intent',
      amount: Math.round(amount * 100), // Stripe uses cents
      currency: 'usd',
      status: 'requires_payment_method',
      client_secret: clientSecret,
      metadata: {
        familySessionFeeId,
        familyId: guardian[0].familyId,
        sessionId: fee.sessionId
      },
      created: Math.floor(Date.now() / 1000),
      description: `DVCLC Session Fee Payment - $${amount.toFixed(2)}`
    }

    return NextResponse.json({
      paymentIntent: mockPaymentIntent,
      clientSecret
    })

  } catch (error) {
    console.error('Error creating payment intent:', error)
    return NextResponse.json(
      { error: 'Failed to create payment intent' },
      { status: 500 }
    )
  }
}