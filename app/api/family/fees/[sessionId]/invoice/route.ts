import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { getGuardianById } from '@/lib/database'
import { db } from '@/lib/db'
import { familySessionFees } from '@/lib/schema'
import { enqueuePaymentInvoice, processQueuedJob } from '@/lib/queued-jobs'

export const maxDuration = 300

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const auth = await getAuthenticatedUser()
    const { sessionId } = await params
    const guardian = await getGuardianById(auth.user.id)
    if (!guardian) return NextResponse.json({ error: 'User not associated with a family' }, { status: 400 })

    const [fee] = await db.select({ id: familySessionFees.id }).from(familySessionFees)
      .where(and(eq(familySessionFees.sessionId, sessionId), eq(familySessionFees.familyId, guardian.familyId)))
      .limit(1)
    if (!fee) return NextResponse.json({ error: 'Fee record not found' }, { status: 404 })

    const job = await enqueuePaymentInvoice(fee.id, guardian.id)
    if (job.status === 'completed') return NextResponse.json({ success: true, jobId: job.id })
    const result = await processQueuedJob(job.id)
    if (result.status === 'failed') {
      console.error(`Invoice job ${job.id} failed permanently:`, result.error)
      return NextResponse.json({ error: 'Failed to schedule invoice delivery', jobId: job.id }, { status: 500 })
    }
    return NextResponse.json({ success: true, queued: result.status !== 'completed', jobId: job.id }, { status: result.status === 'completed' ? 200 : 202 })
  } catch (error) {
    console.error('Error sending payment invoice:', error)
    return NextResponse.json({ error: 'Failed to send invoice' }, { status: 500 })
  }
}
