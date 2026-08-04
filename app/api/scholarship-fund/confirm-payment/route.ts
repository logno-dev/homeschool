import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { scholarshipFundTransactions } from '@/lib/schema'
import { randomUUID } from 'crypto'
import { getGuardianById } from '@/lib/database'
import {
  capturePayPalOrder,
  getCaptureAmountCents,
  parseScholarshipMetadata
} from '@/lib/paypal'

interface ScholarshipConfirmationPayload {
  paymentIntentId?: string
  orderId?: string
  status?: string
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser()
    const payload = await request.json() as ScholarshipConfirmationPayload
    const { status } = payload
    const orderId = payload.orderId || payload.paymentIntentId

    if (!orderId) {
      return NextResponse.json({ error: 'Missing payment order ID' }, { status: 400 })
    }

    if (status && status !== 'succeeded') {
      return NextResponse.json({ success: true })
    }

    const paypalOrder = await capturePayPalOrder(orderId)
    if (paypalOrder.status !== 'COMPLETED') {
      return NextResponse.json({ error: `PayPal order not completed: ${paypalOrder.status}` }, { status: 400 })
    }

    const metadata = parseScholarshipMetadata(paypalOrder)
    if (!metadata) {
      return NextResponse.json({ error: 'Invalid payment metadata' }, { status: 400 })
    }

    const capturedAmountCents = getCaptureAmountCents(paypalOrder)
    if (!capturedAmountCents) {
      return NextResponse.json({ error: 'Unable to read payment amount' }, { status: 400 })
    }

    if (capturedAmountCents !== metadata.feeAmountCents) {
      return NextResponse.json({
        error: `Capture amount mismatch (${capturedAmountCents} != ${metadata.feeAmountCents})`
      }, { status: 400 })
    }

    const guardian = await getGuardianById(session.user.id)
    if (!guardian) {
      return NextResponse.json({ error: 'Guardian not found' }, { status: 404 })
    }

    if (metadata.familyId && metadata.familyId !== guardian.familyId) {
      return NextResponse.json({ error: 'Family mismatch for donation' }, { status: 400 })
    }

    const donationAmount = metadata.feeAmountCents / 100

    await db.insert(scholarshipFundTransactions).values({
      id: randomUUID(),
      amount: donationAmount,
      transactionType: 'donation',
      source: 'online',
      familyId: guardian.familyId,
      createdBy: guardian.id,
      notes: `Scholarship fund donation - Order ID: ${orderId}`
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error recording scholarship donation:', error)
    return NextResponse.json({ error: 'Failed to record donation' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  return POST(request)
}
