import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'

import { getAuthenticatedUser } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { getGuardianById } from '@/lib/database'
import { familySessionFees, feePayments, scholarshipFundTransactions } from '@/lib/schema'
import {
  capturePayPalOrder,
  getCaptureAmountCents,
  parseFeeMetadata
} from '@/lib/paypal'

interface FeeConfirmationPayload {
  paymentIntentId?: string
  orderId?: string
  familySessionFeeId?: string
  status?: string
}

interface ParsedFeeMetadata {
  familySessionFeeId: string
  paymentAmountCents: number
  donationAmountCents: number
}

async function capturePayPalOrderAndReadMetadata(orderId: string, expectedFamilySessionFeeId: string): Promise<ParsedFeeMetadata> {
  const paypalOrder = await capturePayPalOrder(orderId)

  if (paypalOrder.status !== 'COMPLETED') {
    throw new Error(`PayPal order not completed: ${paypalOrder.status}`)
  }

  const metadata = parseFeeMetadata(paypalOrder)

  if (!metadata) {
    throw new Error('Invalid payment metadata')
  }

  if (metadata.familySessionFeeId !== expectedFamilySessionFeeId) {
    throw new Error('Order does not match this fee record')
  }

  const capturedAmountCents = getCaptureAmountCents(paypalOrder)
  const expectedAmountCents = metadata.feeAmountCents + metadata.donationAmountCents

  if (!capturedAmountCents) {
    throw new Error('Unable to read payment amount')
  }

  if (capturedAmountCents !== expectedAmountCents) {
    throw new Error(`Capture amount mismatch (${capturedAmountCents} != ${expectedAmountCents})`)
  }

  return {
    familySessionFeeId: metadata.familySessionFeeId,
    paymentAmountCents: metadata.feeAmountCents,
    donationAmountCents: metadata.donationAmountCents
  }
}

async function recordFeePayment(familySessionFeeId: string, metadata: ParsedFeeMetadata, orderId: string) {
  const feeRecord = await db
    .select()
    .from(familySessionFees)
    .where(eq(familySessionFees.id, familySessionFeeId))
    .limit(1)

  if (feeRecord.length === 0) {
    throw new Error('Fee record not found')
  }

  const fee = feeRecord[0]
  const paymentAmount = metadata.paymentAmountCents / 100
  const donationValue = metadata.donationAmountCents / 100
  const newPaidAmount = fee.paidAmount + paymentAmount
  const newStatus = newPaidAmount >= fee.totalFee ? 'paid' : 'partial'

  await db
    .update(familySessionFees)
    .set({
      paidAmount: newPaidAmount,
      status: newStatus,
      updatedAt: new Date().toISOString()
    })
    .where(eq(familySessionFees.id, familySessionFeeId))

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
      notes: `PayPal order payment - Order ID: ${orderId}`
    })

  if (donationValue > 0) {
    await db
      .insert(scholarshipFundTransactions)
      .values({
        id: randomUUID(),
        amount: donationValue,
        transactionType: 'donation',
        source: 'online',
        familyId: fee.familyId,
        sessionId: fee.sessionId,
        notes: `Scholarship donation with PayPal order ${orderId}`
      })
  }
}

async function handleConfirmation(request: NextRequest) {
  const session = await getAuthenticatedUser()
  const payload = await request.json().catch(() => ({} as FeeConfirmationPayload))
  const { familySessionFeeId, status, orderId: rawOrderId, paymentIntentId } = payload
  const orderId = rawOrderId || paymentIntentId

  if (!orderId) {
    return NextResponse.json({ error: 'Missing payment order ID' }, { status: 400 })
  }

  if (!familySessionFeeId) {
    return NextResponse.json({ error: 'Missing family session fee ID' }, { status: 400 })
  }

  if (status && status !== 'succeeded') {
    return NextResponse.json({ success: true })
  }

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

  const metadata = await capturePayPalOrderAndReadMetadata(orderId, familySessionFeeId)
  await recordFeePayment(familySessionFeeId, metadata, orderId)

  return NextResponse.json({ success: true })
}

export async function POST(request: NextRequest) {
  try {
    return await handleConfirmation(request)
  } catch (error) {
    console.error('Error confirming payment:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to confirm payment' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    return await handleConfirmation(request)
  } catch (error) {
    console.error('Error confirming payment:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to confirm payment' },
      { status: 500 }
    )
  }
}
