import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { randomUUID } from 'crypto'
import { getGuardianById } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser()
    const { amount } = await request.json()

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Donation amount must be greater than 0' }, { status: 400 })
    }

    const guardian = await getGuardianById(session.user.id)
    if (!guardian) {
      return NextResponse.json({ error: 'Guardian not found' }, { status: 404 })
    }

    const paymentIntentId = `pi_donation_${randomUUID().replace(/-/g, '')}`
    const clientSecret = `${paymentIntentId}_secret_${randomUUID().replace(/-/g, '')}`

    const mockPaymentIntent = {
      id: paymentIntentId,
      object: 'payment_intent',
      amount: Math.round(amount * 100),
      currency: 'usd',
      status: 'requires_payment_method',
      client_secret: clientSecret,
      metadata: {
        donationType: 'scholarship_fund',
        familyId: guardian.familyId
      },
      created: Math.floor(Date.now() / 1000),
      description: `Scholarship Fund Donation - $${amount.toFixed(2)}`
    }

    return NextResponse.json({
      paymentIntent: mockPaymentIntent,
      clientSecret
    })
  } catch (error) {
    console.error('Error creating scholarship donation intent:', error)
    return NextResponse.json({ error: 'Failed to create donation intent' }, { status: 500 })
  }
}
