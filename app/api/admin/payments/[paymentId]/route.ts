import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { familySessionFees, feePayments } from '@/lib/schema'
import { getFinancialLineItems } from '@/lib/financial-line-items'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin('payments')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const { paymentId } = await params
    const [record] = await db.select({ paymentId: feePayments.id, fee: familySessionFees })
      .from(feePayments)
      .leftJoin(familySessionFees, and(
        eq(feePayments.familySessionFeeId, familySessionFees.id),
        eq(feePayments.familyId, familySessionFees.familyId)
      ))
      .where(eq(feePayments.id, paymentId))
      .limit(1)

    if (!record) return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    if (!record.fee) return NextResponse.json({ breakdown: null })

    const fee = record.fee
    return NextResponse.json({
      breakdown: {
        lineItems: await getFinancialLineItems(fee),
        totalFee: fee.totalFee,
        paidAmount: fee.paidAmount,
        remainingBalance: Math.max(0, fee.totalFee - fee.paidAmount),
        status: fee.status
      }
    })
  } catch (error) {
    console.error('Error fetching payment fee breakdown:', error)
    return NextResponse.json({ error: 'Unable to load the fee breakdown' }, { status: 500 })
  }
}
