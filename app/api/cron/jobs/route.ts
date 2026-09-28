import { NextResponse } from 'next/server'
import { runScheduledJobs } from '@/lib/scheduled-jobs'

export const maxDuration = 300

function authorized(request: Request) {
  const expected = process.env.CRON_SECRET
  const provided = request.headers.get('x-cron-secret') || request.headers.get('authorization')?.replace(/^Bearer\s+/, '')
  return Boolean(expected && provided === expected)
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ status: 'completed', jobs: await runScheduledJobs() })
}
