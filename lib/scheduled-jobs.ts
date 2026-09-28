import 'server-only'

import { and, asc, eq, inArray, isNull, lt, lte, or } from 'drizzle-orm'
import { getConfiguredDateKey } from '@/lib/app-time'
import { getGradeIncrementSettings, incrementAllStudentGrades, setGradeIncrementDate, setGradeIncrementLastRun } from '@/lib/database'
import { db } from '@/lib/db'
import { processNewsletterCampaign } from '@/lib/newsletter-broadcasts'
import { processDueQueuedJobs } from '@/lib/queued-jobs'
import { classRegistrations, newsletters, scheduledJobs, volunteerAssignments } from '@/lib/schema'

const STALE_LOCK_MS = 10 * 60_000

function getNextAnnualDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year + 1, month - 1, day)).toISOString().slice(0, 10)
}

async function processRegistrationHolds() {
  const now = new Date().toISOString()
  const [registrations, assignments] = await Promise.all([
    db.delete(classRegistrations).where(and(eq(classRegistrations.status, 'hold'), lt(classRegistrations.holdExpiresAt, now))),
    db.delete(volunteerAssignments).where(and(eq(volunteerAssignments.status, 'hold'), lt(volunteerAssignments.holdExpiresAt, now)))
  ])
  return { registrations: registrations.rowsAffected, assignments: assignments.rowsAffected }
}

async function processNewsletters() {
  const campaigns = await db.select().from(newsletters).where(inArray(newsletters.status, ['scheduled', 'processing', 'provider_scheduled'])).orderBy(asc(newsletters.scheduledAt))
  const results = await Promise.all(campaigns.map((campaign) => processNewsletterCampaign(campaign)))
  return {
    campaigns: campaigns.length,
    prepared: results.filter((result) => result === 'prepared' || result === 'sent').length,
    sent: results.filter((result) => result === 'sent').length,
    failed: results.filter((result) => result === 'failed').length
  }
}

async function processGradeIncrement() {
  const { incrementDate, lastRun } = await getGradeIncrementSettings()
  if (!incrementDate) return { status: 'skipped', reason: 'No increment date set' }
  const today = await getConfiguredDateKey()
  if (today !== incrementDate) return { status: 'skipped', reason: 'Not increment date' }
  if (lastRun === today) return { status: 'skipped', reason: 'Already ran today' }
  const result = await incrementAllStudentGrades()
  const nextIncrementDate = getNextAnnualDate(incrementDate)
  await setGradeIncrementLastRun(today)
  await setGradeIncrementDate(nextIncrementDate)
  return { status: 'completed', updated: result.updated, nextIncrementDate }
}

const jobs = [
  { name: 'queued-jobs', intervalMinutes: 5, run: processDueQueuedJobs },
  { name: 'registration-holds', intervalMinutes: 5, run: processRegistrationHolds },
  { name: 'newsletters', intervalMinutes: 5, run: processNewsletters },
  { name: 'grade-increment', intervalMinutes: 60, run: processGradeIncrement }
] as const

export async function runScheduledJobs() {
  const results: Record<string, unknown> = {}
  for (const job of jobs) {
    await db.insert(scheduledJobs).values({ name: job.name, intervalMinutes: job.intervalMinutes }).onConflictDoNothing()
    const now = new Date().toISOString()
    const staleBefore = new Date(Date.now() - STALE_LOCK_MS).toISOString()
    const [configured] = await db.select().from(scheduledJobs).where(eq(scheduledJobs.name, job.name)).limit(1)
    if (!configured?.enabled) {
      results[job.name] = { status: 'disabled' }
      continue
    }
    const [claimed] = await db.update(scheduledJobs).set({ lockedAt: now, updatedAt: now }).where(and(
      eq(scheduledJobs.name, job.name),
      eq(scheduledJobs.enabled, true),
      lte(scheduledJobs.nextRunAt, now),
      or(isNull(scheduledJobs.lockedAt), lte(scheduledJobs.lockedAt, staleBefore))
    )).returning()
    if (!claimed) {
      results[job.name] = { status: 'not_due' }
      continue
    }
    try {
      results[job.name] = await job.run()
      const completedAt = new Date().toISOString()
      const intervalMinutes = Math.max(1, claimed.intervalMinutes)
      await db.update(scheduledJobs).set({
        lockedAt: null,
        lastRunAt: completedAt,
        lastError: null,
        nextRunAt: new Date(Date.now() + intervalMinutes * 60_000).toISOString(),
        updatedAt: completedAt
      }).where(and(eq(scheduledJobs.name, job.name), eq(scheduledJobs.lockedAt, now)))
    } catch (error) {
      console.error(`Scheduled job ${job.name} failed:`, error)
      const message = error instanceof Error ? error.message : 'Unknown scheduled job error'
      await db.update(scheduledJobs).set({ lockedAt: null, lastError: message, nextRunAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(and(eq(scheduledJobs.name, job.name), eq(scheduledJobs.lockedAt, now)))
      results[job.name] = { status: 'failed', error: message }
    }
  }
  return results
}
