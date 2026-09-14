import { asc, inArray } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { newsletters } from '@/lib/schema'
import { processNewsletterCampaign } from '@/lib/newsletter-broadcasts'

function authorized(request: Request) {
  const expected = process.env.CRON_SECRET
  const provided = request.headers.get('x-cron-secret') || request.headers.get('authorization')?.replace(/^Bearer\s+/, '')
  return Boolean(expected && provided === expected)
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Prepare future campaigns early so Resend, rather than this hourly cron,
  // owns the exact send time and delivery pacing.
  const campaigns = await db.select().from(newsletters).where(inArray(newsletters.status, ['scheduled', 'processing', 'provider_scheduled'])).orderBy(asc(newsletters.scheduledAt))
  let prepared = 0
  let sent = 0

  for (const newsletter of campaigns) {
    const result = await processNewsletterCampaign(newsletter)
    if (result === 'prepared' || result === 'sent') prepared += 1
    if (result === 'sent') sent += 1
  }

  return NextResponse.json({ status: 'completed', campaigns: campaigns.length, prepared, sent })
}
