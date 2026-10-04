import { NextResponse } from 'next/server'
import { and, desc, eq, gt, ne } from 'drizzle-orm'
import { db } from '@/lib/db'
import { classFeeRefunds, families, familyClassCharges, familySessionFees, sessions } from '@/lib/schema'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { recordClassFeeRefund, RefundError } from '@/lib/class-fee-refunds'

export async function GET() {
  try {
    const auth = await getAuthenticatedAdmin('payments')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const charges = await db.select({
      charge: familyClassCharges, familyName: families.name, sessionName: sessions.name,
      paidAmount: familySessionFees.paidAmount, totalFee: familySessionFees.totalFee
    }).from(familyClassCharges)
      .innerJoin(families, eq(familyClassCharges.familyId, families.id))
      .innerJoin(sessions, eq(familyClassCharges.sessionId, sessions.id))
      .leftJoin(familySessionFees, and(eq(familyClassCharges.familyId, familySessionFees.familyId), eq(familyClassCharges.sessionId, familySessionFees.sessionId)))
      .where(and(ne(familyClassCharges.status, 'active'), gt(familyClassCharges.amountCents, 0)))
      .orderBy(desc(familyClassCharges.updatedAt))
    const history = await db.select().from(classFeeRefunds).orderBy(desc(classFeeRefunds.createdAt))
    return NextResponse.json({ charges, history })
  } catch (error) {
    console.error('Unable to load class refund reviews:', error)
    return NextResponse.json({ error: 'Unable to load class refunds' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedAdmin('payments')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const id = await recordClassFeeRefund(await request.json(), auth.session.user.id)
    return NextResponse.json({ success: true, id })
  } catch (error) {
    if (error instanceof RefundError) return NextResponse.json({ error: error.message }, { status: 409 })
    console.error('Unable to record class refund:', error)
    return NextResponse.json({ error: 'Unable to record refund' }, { status: 500 })
  }
}
