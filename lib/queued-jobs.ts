import 'server-only'

import { randomUUID } from 'crypto'
import { and, asc, eq, lte, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { sendPaymentInvoiceEmail } from '@/lib/email'
import { getFinancialLineItems } from '@/lib/financial-line-items'
import { PermanentJobError } from '@/lib/job-errors'
import { families, familySessionFees, guardians, queuedJobs, sessions } from '@/lib/schema'

const INVOICE_JOB = 'payment_invoice'
const STALE_LOCK_MS = 10 * 60_000

type InvoiceJobPayload = {
  feeId: string
  guardianId: string
  feeVersion: string
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown queued job error'
}

function retryAt(attempts: number) {
  const delayMinutes = Math.min(60, 5 * (2 ** Math.max(0, attempts - 1)))
  return new Date(Date.now() + delayMinutes * 60_000).toISOString()
}

async function deliverInvoice(jobId: string, rawPayload: string, attempt: number) {
  let payload: InvoiceJobPayload
  try {
    payload = JSON.parse(rawPayload) as InvoiceJobPayload
  } catch {
    throw new PermanentJobError('Invoice job payload is not valid JSON')
  }
  if (!payload.feeId || !payload.guardianId || !payload.feeVersion) throw new PermanentJobError('Invoice job is missing its fee, guardian ID, or version')

  const [invoice] = await db.select({
    sessionId: familySessionFees.sessionId,
    registrationFee: familySessionFees.registrationFee,
    classFees: familySessionFees.classFees,
    totalFee: familySessionFees.totalFee,
    paidAmount: familySessionFees.paidAmount,
    dueDate: familySessionFees.dueDate,
    updatedAt: familySessionFees.updatedAt,
    sessionName: sessions.name,
    familyId: families.id,
    familyName: families.name,
    guardianId: guardians.id,
    guardianEmail: guardians.email,
    guardianFirstName: guardians.firstName
  }).from(familySessionFees)
    .innerJoin(sessions, eq(familySessionFees.sessionId, sessions.id))
    .innerJoin(families, eq(familySessionFees.familyId, families.id))
    .innerJoin(guardians, and(eq(guardians.id, payload.guardianId), eq(guardians.familyId, families.id)))
    .where(eq(familySessionFees.id, payload.feeId))
    .limit(1)
  if (!invoice) throw new PermanentJobError('The fee or invoice recipient no longer exists')
  if (invoice.updatedAt !== payload.feeVersion) return

  await sendPaymentInvoiceEmail({
    lineItems: await getFinancialLineItems(invoice),
    to: invoice.guardianEmail,
    firstName: invoice.guardianFirstName,
    familyName: invoice.familyName,
    sessionName: invoice.sessionName,
    totalAmount: invoice.totalFee,
    amountPaid: invoice.paidAmount,
    balanceDue: Math.max(0, invoice.totalFee - invoice.paidAmount),
    dueDate: invoice.dueDate,
    userId: invoice.guardianId,
    familyId: invoice.familyId
  }, jobId, `${jobId}-report-submission-${attempt}`, async () => {
    const [currentFee] = await db.select({ updatedAt: familySessionFees.updatedAt }).from(familySessionFees).where(eq(familySessionFees.id, payload.feeId)).limit(1)
    return currentFee?.updatedAt === payload.feeVersion
  })
}

const handlers: Record<string, (jobId: string, payload: string, attempt: number) => Promise<void>> = {
  [INVOICE_JOB]: deliverInvoice
}

export async function enqueuePaymentInvoice(feeId: string, guardianId: string) {
  const now = new Date().toISOString()
  const [fee] = await db.select({ updatedAt: familySessionFees.updatedAt }).from(familySessionFees).where(eq(familySessionFees.id, feeId)).limit(1)
  if (!fee) throw new PermanentJobError('The fee for this invoice no longer exists')
  const deduplicationKey = `${INVOICE_JOB}:${feeId}:${guardianId}:${fee.updatedAt}`
  await db.insert(queuedJobs).values({
    id: randomUUID(),
    type: INVOICE_JOB,
    deduplicationKey,
    payload: JSON.stringify({ feeId, guardianId, feeVersion: fee.updatedAt } satisfies InvoiceJobPayload),
    nextAttemptAt: now,
    updatedAt: now
  }).onConflictDoNothing()

  const [job] = await db.select().from(queuedJobs).where(eq(queuedJobs.deduplicationKey, deduplicationKey)).limit(1)
  if (!job) throw new Error('Unable to persist invoice delivery job')
  if (job.status === 'failed') {
    const [requeued] = await db.update(queuedJobs).set({
      status: 'queued',
      payload: JSON.stringify({ feeId, guardianId, feeVersion: fee.updatedAt } satisfies InvoiceJobPayload),
      nextAttemptAt: now,
      lockedAt: null,
      lastError: null,
      updatedAt: now
    }).where(eq(queuedJobs.id, job.id)).returning()
    return requeued || job
  }
  return job
}

export async function processQueuedJob(id: string) {
  const now = new Date().toISOString()
  const staleBefore = new Date(Date.now() - STALE_LOCK_MS).toISOString()
  const [job] = await db.update(queuedJobs).set({
    status: 'processing',
    attempts: sql`${queuedJobs.attempts} + 1`,
    lockedAt: now,
    updatedAt: now
  }).where(and(
    eq(queuedJobs.id, id),
    or(
      and(eq(queuedJobs.status, 'queued'), lte(queuedJobs.nextAttemptAt, now)),
      and(eq(queuedJobs.status, 'processing'), lte(queuedJobs.lockedAt, staleBefore))
    )
  )).returning()
  if (!job) return { status: 'skipped' as const }

  const handler = handlers[job.type]
  if (!handler) {
    const message = `No queued job handler is configured for ${job.type}`
    await db.update(queuedJobs).set({ status: 'failed', lockedAt: null, lastError: message, updatedAt: new Date().toISOString() }).where(eq(queuedJobs.id, job.id))
    return { status: 'failed' as const, error: message }
  }

  try {
    await handler(job.id, job.payload, job.attempts)
    const completedAt = new Date().toISOString()
    const completed = await db.update(queuedJobs).set({ status: 'completed', lockedAt: null, lastError: null, completedAt, updatedAt: completedAt }).where(and(eq(queuedJobs.id, job.id), eq(queuedJobs.status, 'processing'), eq(queuedJobs.lockedAt, now)))
    return { status: completed.rowsAffected ? 'completed' as const : 'skipped' as const }
  } catch (error) {
    const message = errorMessage(error)
    if (error instanceof PermanentJobError) {
      const failed = await db.update(queuedJobs).set({ status: 'failed', lockedAt: null, lastError: message, updatedAt: new Date().toISOString() }).where(and(eq(queuedJobs.id, job.id), eq(queuedJobs.status, 'processing'), eq(queuedJobs.lockedAt, now)))
      return failed.rowsAffected ? { status: 'failed' as const, error: message } : { status: 'skipped' as const }
    }
    const requeued = await db.update(queuedJobs).set({ status: 'queued', lockedAt: null, lastError: message, nextAttemptAt: retryAt(job.attempts), updatedAt: new Date().toISOString() }).where(and(eq(queuedJobs.id, job.id), eq(queuedJobs.status, 'processing'), eq(queuedJobs.lockedAt, now)))
    return requeued.rowsAffected ? { status: 'queued' as const, error: message } : { status: 'skipped' as const }
  }
}

export async function processDueQueuedJobs() {
  const now = new Date().toISOString()
  const staleBefore = new Date(Date.now() - STALE_LOCK_MS).toISOString()
  const configuredBatchSize = Number(process.env.JOB_RUNNER_BATCH_SIZE) || 10
  const batchSize = Math.min(50, Math.max(1, configuredBatchSize))
  const dueJobs = await db.select({ id: queuedJobs.id }).from(queuedJobs).where(or(
    and(eq(queuedJobs.status, 'queued'), lte(queuedJobs.nextAttemptAt, now)),
    and(eq(queuedJobs.status, 'processing'), lte(queuedJobs.lockedAt, staleBefore))
  )).orderBy(asc(queuedJobs.nextAttemptAt)).limit(batchSize)

  const summary = { found: dueJobs.length, completed: 0, queued: 0, failed: 0, skipped: 0 }
  const results = await Promise.all(dueJobs.map((dueJob) => processQueuedJob(dueJob.id)))
  for (const result of results) summary[result.status] += 1
  return summary
}
