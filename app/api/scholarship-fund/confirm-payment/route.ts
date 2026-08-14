import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { scholarshipFundTransactions } from '@/lib/schema'
import { randomUUID } from 'crypto'
import { getGuardianById } from '@/lib/database'
import {
  capturePayPalOrder,
  getCaptureAmountCents,
  parseScholarshipMetadata,
  logPayPalDebug,
  summarizePayPalOrderForDebug
} from '@/lib/paypal'

interface ScholarshipConfirmationPayload {
  paymentIntentId?: string
  orderId?: string
  status?: string
  expectedDonationAmountCents?: number
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser()
    const payload = await request.json() as ScholarshipConfirmationPayload
    const { status, expectedDonationAmountCents } = payload
    const orderId = payload.orderId || payload.paymentIntentId

    logPayPalDebug('Received scholarship confirmation request', {
      orderId,
      expectedDonationAmountCents,
      status
    })

    if (!orderId) {
      return NextResponse.json({ error: 'Missing payment order ID' }, { status: 400 })
    }

    if (status && status !== 'succeeded') {
      return NextResponse.json({ success: true })
    }

    const paypalOrder = await capturePayPalOrder(orderId)
    const paypalDebugSummary = summarizePayPalOrderForDebug(paypalOrder)
    if (paypalOrder.status !== 'COMPLETED') {
      logPayPalDebug('Scholarship order not completed', {
        orderId,
        status: paypalOrder.status,
        paypalOrder: paypalDebugSummary
      })
      return NextResponse.json({ error: `PayPal order not completed: ${paypalOrder.status}` }, { status: 400 })
    }

    const capturedAmountCents = getCaptureAmountCents(paypalOrder)
    if (!capturedAmountCents) {
      logPayPalDebug('Unable to read scholarship capture amount', {
        orderId,
        paypalOrder: paypalDebugSummary
      })
      return NextResponse.json({ error: 'Unable to read payment amount' }, { status: 400 })
    }

    const metadata = parseScholarshipMetadata(paypalOrder)
    logPayPalDebug('Resolved scholarship metadata for confirmation', {
      orderId,
      status: paypalOrder.status,
      metadata,
      expectedDonationAmountCents
    })

    const resolvedDonationAmountCents = (() => {
      if (metadata && Number.isFinite(metadata.feeAmountCents) && metadata.feeAmountCents > 0) {
        return Math.round(metadata.feeAmountCents)
      }

      const expected = Number(payload.expectedDonationAmountCents)
      if (Number.isFinite(expected) && expected > 0) {
        return Math.round(expected)
      }

      return 0
    })()

    if (!metadata && resolvedDonationAmountCents === 0) {
      logPayPalDebug('Invalid scholarship metadata and no resolved expected amount', {
        orderId,
        expectedDonationAmountCents
      })
      return NextResponse.json({ error: 'Invalid payment metadata' }, { status: 400 })
    }

    if (capturedAmountCents !== resolvedDonationAmountCents) {
      logPayPalDebug('Scholarship capture amount mismatch', {
        orderId,
        capturedAmountCents,
        resolvedDonationAmountCents,
        metadata: metadata ?? null,
        expectedDonationAmountCents
      })
      return NextResponse.json({
        error: `Capture amount mismatch (${capturedAmountCents} != ${resolvedDonationAmountCents})`
      }, { status: 400 })
    }

    const guardian = await getGuardianById(session.user.id)
    if (!guardian) {
      return NextResponse.json({ error: 'Guardian not found' }, { status: 404 })
    }

    if (metadata?.familyId && metadata.familyId !== guardian.familyId) {
      logPayPalDebug('Scholarship family mismatch', {
        orderId,
        metadataFamilyId: metadata.familyId,
        guardianFamilyId: guardian.familyId
      })
      return NextResponse.json({ error: 'Family mismatch for donation' }, { status: 400 })
    }

    const donationAmount = resolvedDonationAmountCents / 100

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
    const paypalError = (error as Error & { payPalError?: unknown }).payPalError
    const payPalStatus = (error as Error & { payPalStatus?: number }).payPalStatus
    const payPalDebugId = (error as Error & { payPalDebugId?: string | null }).payPalDebugId
    logPayPalDebug('Scholarship confirmation failed', {
      error: error instanceof Error ? error.message : 'unknown',
      payPalStatus,
      payPalDebugId,
      paypalError
    })
    console.error('Error recording scholarship donation:', error)
    return NextResponse.json({ error: 'Failed to record donation' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  return POST(request)
}
