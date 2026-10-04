import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { children, classTeachingRequests, families, familySessionFees, sessions } from '@/lib/schema'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { recordHistoricalClassRefund } from '@/lib/historical-class-refunds'
import { RefundError } from '@/lib/class-fee-refunds'

export async function GET(request: Request) {
  try {
    const auth = await getAuthenticatedAdmin('payments')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const feeId = new URL(request.url).searchParams.get('feeId')
    if (!feeId) {
      const bills = await db.select({ id: familySessionFees.id, familyName: families.name, sessionName: sessions.name })
        .from(familySessionFees).innerJoin(families, eq(familySessionFees.familyId, families.id)).innerJoin(sessions, eq(familySessionFees.sessionId, sessions.id))
      return NextResponse.json({ bills })
    }
    const [fee] = await db.select().from(familySessionFees).where(eq(familySessionFees.id, feeId))
    if (!fee) return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
    const students = await db.select({ id: children.id, name: children.firstName }).from(children).where(eq(children.familyId, fee.familyId))
    const classes = await db.select({ id: classTeachingRequests.id, name: classTeachingRequests.className }).from(classTeachingRequests).where(eq(classTeachingRequests.sessionId, fee.sessionId))
    return NextResponse.json({ students, classes, totalFee: fee.totalFee, paidAmount: fee.paidAmount })
  } catch (error) {
    console.error('Unable to load historical refund options:', error)
    return NextResponse.json({ error: 'Unable to load refund options' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedAdmin('payments')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const id = await recordHistoricalClassRefund(await request.json(), auth.session.user.id)
    return NextResponse.json({ success: true, id })
  } catch (error) {
    if (error instanceof RefundError) return NextResponse.json({ error: error.message }, { status: 409 })
    console.error('Unable to record historical class refund:', error)
    return NextResponse.json({ error: 'Unable to record historical refund' }, { status: 500 })
  }
}
