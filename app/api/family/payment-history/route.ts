import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { feePayments, familySessionFees, sessions, guardians } from '@/lib/schema'
import { eq, desc } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser()

    // Get guardian info to find family
    const guardian = await db
      .select()
      .from(guardians)
      .where(eq(guardians.id, session.user.id))
      .limit(1)

    if (guardian.length === 0) {
      return NextResponse.json({ error: 'Guardian not found' }, { status: 404 })
    }

    // Get payment history for the family
    const payments = await db
      .select({
        id: feePayments.id,
        amount: feePayments.amount,
        paymentDate: feePayments.paymentDate,
        paymentMethod: feePayments.paymentMethod,
        notes: feePayments.notes,
        sessionName: sessions.name,
        sessionId: sessions.id,
        totalFee: familySessionFees.totalFee,
        registrationFee: familySessionFees.registrationFee,
        classFees: familySessionFees.classFees
      })
      .from(feePayments)
      .leftJoin(familySessionFees, eq(feePayments.familySessionFeeId, familySessionFees.id))
      .leftJoin(sessions, eq(familySessionFees.sessionId, sessions.id))
      .where(eq(feePayments.familyId, guardian[0].familyId))
      .orderBy(desc(feePayments.paymentDate))

    return NextResponse.json({
      payments: payments.map(payment => ({
        ...payment,
        paymentDate: payment.paymentDate,
        sessionName: payment.sessionName || 'Unknown Session'
      }))
    })

  } catch (error) {
    console.error('Error fetching payment history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch payment history' },
      { status: 500 }
    )
  }
}