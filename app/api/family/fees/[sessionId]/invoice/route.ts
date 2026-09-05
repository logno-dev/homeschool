import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { getGuardianById } from '@/lib/database'
import { db } from '@/lib/db'
import { familySessionFees, sessions, families } from '@/lib/schema'
import { sendPaymentInvoiceEmail } from '@/lib/email'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const auth = await getAuthenticatedUser()
    const { sessionId } = await params
    const guardian = await getGuardianById(auth.user.id)
    if (!guardian) return NextResponse.json({ error: 'User not associated with a family' }, { status: 400 })

    const [fee] = await db.select({
      id: familySessionFees.id,
      totalFee: familySessionFees.totalFee,
      paidAmount: familySessionFees.paidAmount,
      dueDate: familySessionFees.dueDate,
      sessionName: sessions.name,
      familyName: families.name
    }).from(familySessionFees)
      .innerJoin(sessions, eq(familySessionFees.sessionId, sessions.id))
      .innerJoin(families, eq(familySessionFees.familyId, families.id))
      .where(and(eq(familySessionFees.sessionId, sessionId), eq(familySessionFees.familyId, guardian.familyId)))
      .limit(1)
    if (!fee) return NextResponse.json({ error: 'Fee record not found' }, { status: 404 })

    await sendPaymentInvoiceEmail({
      to: guardian.email,
      firstName: guardian.firstName,
      familyName: fee.familyName,
      sessionName: fee.sessionName,
      totalAmount: fee.totalFee,
      amountPaid: fee.paidAmount,
      balanceDue: Math.max(0, fee.totalFee - fee.paidAmount),
      dueDate: fee.dueDate
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error sending payment invoice:', error)
    return NextResponse.json({ error: 'Failed to send invoice' }, { status: 500 })
  }
}
