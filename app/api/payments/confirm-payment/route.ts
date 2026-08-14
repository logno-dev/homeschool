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
  parseFeeMetadata,
  logPayPalDebug,
  summarizePayPalOrderForDebug
} from '@/lib/paypal'

interface FeeConfirmationPayload {
  paymentIntentId?: string
  orderId?: string
  familySessionFeeId?: string
  status?: string
  expectedFeeAmountCents?: number
  expectedDonationAmountCents?: number
}

interface ParsedFeeMetadata {
  familySessionFeeId: string
  paymentAmountCents: number
  donationAmountCents: number
}

async function capturePayPalOrderAndReadMetadata(
  orderId: string,
  expectedFamilySessionFeeId: string,
  expectedFeeAmountCents?: number,
  expectedDonationAmountCents?: number
): Promise<ParsedFeeMetadata> {
  const paypalOrder = await capturePayPalOrder(orderId)

  if (paypalOrder.status !== 'COMPLETED') {
    throw new Error(`PayPal order not completed: ${paypalOrder.status}`)
  }

  const metadata = parseFeeMetadata(paypalOrder)
  const paypalDebugSummary = summarizePayPalOrderForDebug(paypalOrder)
  const capturedAmountCents = getCaptureAmountCents(paypalOrder)

  logPayPalDebug('Processing payment confirmation metadata', {
    orderId,
    expectedFamilySessionFeeId,
    capturedAmountCents,
    expectedFeeAmountCents,
    expectedDonationAmountCents,
    parsedMetadata: metadata,
    paypalOrder: paypalDebugSummary
  })

  if (!capturedAmountCents) {
    throw new Error('Unable to read payment amount')
  }

  const hasExpectedFeeInput = expectedFeeAmountCents !== undefined && Number.isFinite(expectedFeeAmountCents)
  const hasExpectedDonationInput =
    expectedDonationAmountCents !== undefined && Number.isFinite(expectedDonationAmountCents)

  const normalizedExpectedFeeAmountCents = hasExpectedFeeInput
    ? Math.round(expectedFeeAmountCents)
    : 0
  const normalizedExpectedDonationAmountCents = hasExpectedDonationInput
    ? Math.round(expectedDonationAmountCents)
    : 0

  const fallbackMetadata = (() => {
    const hasExpectedFee = hasExpectedFeeInput && normalizedExpectedFeeAmountCents > 0
    const hasExpectedDonation = hasExpectedDonationInput && normalizedExpectedDonationAmountCents >= 0

    if (!metadata) {
      if (!hasExpectedFee && !hasExpectedDonation) {
        return {
          familySessionFeeId: expectedFamilySessionFeeId,
          paymentAmountCents: capturedAmountCents,
          donationAmountCents: 0
        }
      }

      const normalizedFeeAmountCents = hasExpectedFee ? normalizedExpectedFeeAmountCents : 0
      const normalizedDonationAmountCents = hasExpectedDonation ? normalizedExpectedDonationAmountCents : 0
      if (normalizedFeeAmountCents + normalizedDonationAmountCents !== capturedAmountCents) {
        return null
      }

      return {
        familySessionFeeId: expectedFamilySessionFeeId,
        paymentAmountCents: normalizedFeeAmountCents,
        donationAmountCents: normalizedDonationAmountCents
      }
    }

    if (metadata.feeAmountCents !== 0 || metadata.donationAmountCents !== 0) {
      return null
    }

    if (!hasExpectedFee && !hasExpectedDonation) {
      return {
        familySessionFeeId: metadata.familySessionFeeId,
        paymentAmountCents: capturedAmountCents,
        donationAmountCents: 0
      }
    }

    const normalizedFeeAmountCents = hasExpectedFee ? normalizedExpectedFeeAmountCents : 0
    const normalizedDonationAmountCents = hasExpectedDonation ? normalizedExpectedDonationAmountCents : 0
    if (normalizedFeeAmountCents + normalizedDonationAmountCents !== capturedAmountCents) {
      return null
    }

    return {
      familySessionFeeId: metadata.familySessionFeeId,
      paymentAmountCents: normalizedFeeAmountCents,
      donationAmountCents: normalizedDonationAmountCents
    }
  })()

  if (fallbackMetadata) {
    logPayPalDebug('Resolved fee metadata via fallback path', {
      orderId,
      familySessionFeeId: fallbackMetadata.familySessionFeeId,
      paymentAmountCents: fallbackMetadata.paymentAmountCents,
      donationAmountCents: fallbackMetadata.donationAmountCents,
      expectedFeeAmountCents,
      expectedDonationAmountCents
    })

    if (fallbackMetadata.familySessionFeeId !== expectedFamilySessionFeeId) {
      logPayPalDebug('Fee record mismatch in fallback metadata', {
        orderId,
        expectedFamilySessionFeeId,
        fallbackFamilySessionFeeId: fallbackMetadata.familySessionFeeId
      })
      throw new Error('Order does not match this fee record')
    }

    return {
      familySessionFeeId: fallbackMetadata.familySessionFeeId,
      paymentAmountCents: fallbackMetadata.paymentAmountCents,
      donationAmountCents: fallbackMetadata.donationAmountCents
    }
  }

  if (!metadata) {
    logPayPalDebug('PayPal metadata missing and no fallback match', {
      orderId,
      expectedFamilySessionFeeId,
      expectedFeeAmountCents,
      expectedDonationAmountCents,
      paypalOrder: paypalDebugSummary
    })
    throw new Error('Invalid payment metadata')
  }

  if (metadata.familySessionFeeId !== expectedFamilySessionFeeId) {
    logPayPalDebug('PayPal metadata fee ID mismatch', {
      orderId,
      expectedFamilySessionFeeId,
      metadataFamilySessionFeeId: metadata.familySessionFeeId
    })
    throw new Error('Order does not match this fee record')
  }

  const expectedAmountCents = metadata.feeAmountCents + metadata.donationAmountCents

  if (capturedAmountCents !== expectedAmountCents) {
    logPayPalDebug('PayPal capture amount mismatch', {
      orderId,
      expectedAmountCents,
      capturedAmountCents,
      metadataFeeCents: metadata.feeAmountCents,
      metadataDonationCents: metadata.donationAmountCents
    })
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
  const {
    familySessionFeeId,
    status,
    orderId: rawOrderId,
    paymentIntentId,
    expectedFeeAmountCents,
    expectedDonationAmountCents
  } = payload
  const orderId = rawOrderId || paymentIntentId

  logPayPalDebug('Received fee confirmation request', {
    orderId,
    familySessionFeeId,
    status,
    expectedFeeAmountCents,
    expectedDonationAmountCents
  })

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

  const metadata = await capturePayPalOrderAndReadMetadata(
    orderId,
    familySessionFeeId,
    expectedFeeAmountCents,
    expectedDonationAmountCents
  )
  logPayPalDebug('Resolved payment metadata for recording', {
    orderId,
    familySessionFeeId,
    paymentAmountCents: metadata.paymentAmountCents,
    donationAmountCents: metadata.donationAmountCents
  })
  await recordFeePayment(familySessionFeeId, metadata, orderId)

  return NextResponse.json({ success: true })
}

export async function POST(request: NextRequest) {
  try {
    return await handleConfirmation(request)
  } catch (error) {
    const paypalError = (error as Error & { payPalError?: unknown }).payPalError
    const payPalStatus = (error as Error & { payPalStatus?: number }).payPalStatus
    const payPalDebugId = (error as Error & { payPalDebugId?: string | null }).payPalDebugId
    logPayPalDebug('Payment confirmation failed', {
      error: error instanceof Error ? error.message : 'unknown',
      payPalStatus,
      payPalDebugId,
      paypalError
    })
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
    const paypalError = (error as Error & { payPalError?: unknown }).payPalError
    const payPalStatus = (error as Error & { payPalStatus?: number }).payPalStatus
    const payPalDebugId = (error as Error & { payPalDebugId?: string | null }).payPalDebugId
    logPayPalDebug('Payment confirmation failed', {
      error: error instanceof Error ? error.message : 'unknown',
      payPalStatus,
      payPalDebugId,
      paypalError
    })
    console.error('Error confirming payment:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to confirm payment' },
      { status: 500 }
    )
  }
}
