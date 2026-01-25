import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { scholarshipFundTransactions } from '@/lib/schema'
import { randomUUID } from 'crypto'
import { getGuardianById } from '@/lib/database'

export async function PUT(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser()
    const { paymentIntentId, status, amount } = await request.json()

    if (status !== 'succeeded') {
      return NextResponse.json({ success: true })
    }

    const guardian = await getGuardianById(session.user.id)
    if (!guardian) {
      return NextResponse.json({ error: 'Guardian not found' }, { status: 404 })
    }

    const donationAmount = amount / 100

    await db.insert(scholarshipFundTransactions).values({
      id: randomUUID(),
      amount: donationAmount,
      transactionType: 'donation',
      source: 'online',
      familyId: guardian.familyId,
      createdBy: guardian.id,
      notes: `Scholarship fund donation - Intent ID: ${paymentIntentId}`
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error recording scholarship donation:', error)
    return NextResponse.json({ error: 'Failed to record donation' }, { status: 500 })
  }
}
