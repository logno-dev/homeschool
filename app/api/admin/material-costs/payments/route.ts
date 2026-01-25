import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { classMaterialPayments } from '@/lib/schema'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { chargeId, familyId, payerName, amount, paymentDate, paymentMethod, notes } = await request.json()

    if (!chargeId || !amount || !paymentDate || !paymentMethod) {
      return NextResponse.json({ error: 'Charge, amount, payment date, and method are required' }, { status: 400 })
    }

    const paymentId = randomUUID()
    await db.insert(classMaterialPayments).values({
      id: paymentId,
      chargeId,
      familyId: familyId || null,
      payerName: payerName?.trim() || null,
      amount,
      paymentDate,
      paymentMethod,
      notes: notes?.trim() || null
    })

    return NextResponse.json({ success: true, id: paymentId })
  } catch (error) {
    console.error('Error recording material payment:', error)
    return NextResponse.json({ error: 'Failed to record material payment' }, { status: 500 })
  }
}
