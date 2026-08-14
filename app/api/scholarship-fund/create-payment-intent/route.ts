import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { getGuardianById } from '@/lib/database'
import {
  createPayPalOrder,
  getPayPalMetadata,
  makeScholarshipMetadata,
  toAmountCents
} from '@/lib/paypal'

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser()
    const { amount } = await request.json()
    const donationAmount = Number(amount)

    if (!Number.isFinite(donationAmount) || donationAmount <= 0) {
      return NextResponse.json({ error: 'Donation amount must be greater than 0' }, { status: 400 })
    }

    const guardian = await getGuardianById(session.user.id)
    if (!guardian) {
      return NextResponse.json({ error: 'Guardian not found' }, { status: 404 })
    }

    const amountCents = toAmountCents(donationAmount)
    const metadata = makeScholarshipMetadata({
      familySessionFeeId: guardian.familyId,
      amountCents
    })

    const orderId = await createPayPalOrder({
      totalAmountCents: amountCents,
      ...metadata,
      description: `Scholarship Fund Donation - $${donationAmount.toFixed(2)}`
    })

    const { isSandbox, clientId } = getPayPalMetadata()

    return NextResponse.json({
      orderId,
      clientId,
      isSandbox,
      environment: isSandbox ? 'sandbox' : 'live',
      expectedDonationAmountCents: amountCents
    })
  } catch (error) {
    console.error('Error creating scholarship donation intent:', error)
    return NextResponse.json({ error: 'Failed to create donation intent' }, { status: 500 })
  }
}
