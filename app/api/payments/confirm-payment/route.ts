import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { familySessionFees, feePayments, guardians } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'

// Mock Stripe Payment confirmation
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser()

    const { paymentIntentId, paymentMethodId } = await request.json()

    // In a real Stripe integration, we would:
    // 1. Confirm the payment intent with Stripe
    // 2. Handle webhooks for payment status updates
    // For mock purposes, we'll simulate a successful payment

    // Extract metadata from payment intent ID (in real app, this would come from Stripe)
    if (!paymentIntentId.startsWith('pi_mock_')) {
      return NextResponse.json({ error: 'Invalid payment intent' }, { status: 400 })
    }

    // For demo purposes, we'll simulate payment success/failure
    // In real implementation, this would be handled by Stripe webhooks
    const shouldSucceed = Math.random() > 0.1 // 90% success rate for demo

    if (!shouldSucceed) {
      return NextResponse.json({
        paymentIntent: {
          id: paymentIntentId,
          status: 'requires_payment_method',
          last_payment_error: {
            type: 'card_error',
            code: 'card_declined',
            message: 'Your card was declined. Please try a different payment method.'
          }
        }
      })
    }

    // Mock successful payment - in real app, this would be triggered by Stripe webhook
    const mockPaymentIntent = {
      id: paymentIntentId,
      object: 'payment_intent',
      status: 'succeeded',
      amount_received: 5000, // This would come from the actual payment intent
      currency: 'usd',
      payment_method: paymentMethodId,
      created: Math.floor(Date.now() / 1000)
    }

    return NextResponse.json({
      paymentIntent: mockPaymentIntent
    })

  } catch (error) {
    console.error('Error confirming payment:', error)
    return NextResponse.json(
      { error: 'Failed to confirm payment' },
      { status: 500 }
    )
  }
}

// Webhook endpoint to handle payment status updates (mock)
export async function PUT(request: NextRequest) {
  try {
    const { paymentIntentId, status, amount, familySessionFeeId } = await request.json()

    if (status === 'succeeded') {
      // Update the family session fee with the payment
      const familyFee = await db
        .select()
        .from(familySessionFees)
        .where(eq(familySessionFees.id, familySessionFeeId))
        .limit(1)

      if (familyFee.length === 0) {
        return NextResponse.json({ error: 'Fee record not found' }, { status: 404 })
      }

      const fee = familyFee[0]
      const paymentAmount = amount / 100 // Convert from cents
      const newPaidAmount = fee.paidAmount + paymentAmount
      const newStatus = newPaidAmount >= fee.totalFee ? 'paid' : 'partial'

      // Update the family session fee
      await db
        .update(familySessionFees)
        .set({
          paidAmount: newPaidAmount,
          status: newStatus,
          updatedAt: new Date().toISOString()
        })
        .where(eq(familySessionFees.id, familySessionFeeId))

      // Record the payment
      await db
        .insert(feePayments)
        .values({
          id: randomUUID(),
          familySessionFeeId,
          familyId: fee.familyId,
          sessionId: fee.sessionId,
          amount: paymentAmount,
          paymentDate: new Date().toISOString(),
          paymentMethod: 'online',
          notes: `Mock Stripe payment - Intent ID: ${paymentIntentId}`
        })

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error processing payment webhook:', error)
    return NextResponse.json(
      { error: 'Failed to process payment webhook' },
      { status: 500 }
    )
  }
}