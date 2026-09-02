import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { and, desc, eq, gt } from 'drizzle-orm'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { families, familySessionFees, feePayments, sessions } from '@/lib/schema'

export async function GET() {
  const auth = await getAuthenticatedAdmin('payments')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const overpayments = await db.select({
    feeId: familySessionFees.id,
    familyId: families.id,
    familyName: families.name,
    sessionId: sessions.id,
    sessionName: sessions.name,
    amount: familySessionFees.overpaymentAmount,
    status: familySessionFees.overpaymentStatus,
    resolvedAt: familySessionFees.overpaymentResolvedAt,
    resolutionNotes: familySessionFees.overpaymentResolutionNotes
  }).from(familySessionFees)
    .innerJoin(families, eq(familySessionFees.familyId, families.id))
    .innerJoin(sessions, eq(familySessionFees.sessionId, sessions.id))
    .where(gt(familySessionFees.overpaymentAmount, 0))
    .orderBy(desc(familySessionFees.updatedAt))
  return NextResponse.json({ overpayments })
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedAdmin('payments')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const { feeId, disposition, notes } = await request.json()
    if (!feeId || !['cash', 'wire'].includes(disposition)) return NextResponse.json({ error: 'Fee and cash or wire disposition are required' }, { status: 400 })

    const fee = await db.select().from(familySessionFees).where(eq(familySessionFees.id, feeId)).limit(1)
    if (!fee[0]) return NextResponse.json({ error: 'Fee record not found' }, { status: 404 })
    const amount = Math.max(0, fee[0].paidAmount - fee[0].totalFee)
    if (amount <= 0 || fee[0].overpaymentStatus !== 'pending') return NextResponse.json({ error: 'No unresolved overpayment is available' }, { status: 400 })

    const now = new Date().toISOString()
    await db.transaction(async (tx) => {
      await tx.insert(feePayments).values({
        id: randomUUID(),
        familySessionFeeId: fee[0].id,
        familyId: fee[0].familyId,
        sessionId: fee[0].sessionId,
        amount: -amount,
        paymentDate: now,
        paymentMethod: disposition === 'cash' ? 'refund_cash' : 'refund_wire',
        notes: notes?.trim() || `Overpayment refunded by ${disposition}`,
        createdAt: now
      })
      await tx.update(familySessionFees).set({
        paidAmount: fee[0].totalFee,
        status: 'paid',
        overpaymentAmount: 0,
        overpaymentStatus: disposition,
        overpaymentResolvedAt: now,
        overpaymentResolvedBy: auth.session.user.id,
        overpaymentResolutionNotes: notes?.trim() || `Refunded by ${disposition}`,
        updatedAt: now
      }).where(eq(familySessionFees.id, fee[0].id))
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error resolving admin overpayment:', error)
    return NextResponse.json({ error: 'Failed to resolve overpayment' }, { status: 500 })
  }
}
