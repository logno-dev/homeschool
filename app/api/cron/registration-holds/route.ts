import { NextResponse } from 'next/server'
import { and, lt, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { classRegistrations, volunteerAssignments } from '@/lib/schema'

function getCronSecret(request: Request) {
  const headerSecret = request.headers.get('x-cron-secret')
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.replace('Bearer ', '')
  }
  return headerSecret
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }

  const providedSecret = getCronSecret(request)
  if (!providedSecret || providedSecret !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date().toISOString()

  await db
    .delete(classRegistrations)
    .where(and(
      eq(classRegistrations.status, 'hold'),
      lt(classRegistrations.holdExpiresAt, now)
    ))

  await db
    .delete(volunteerAssignments)
    .where(and(
      eq(volunteerAssignments.status, 'hold'),
      lt(volunteerAssignments.holdExpiresAt, now)
    ))

  return NextResponse.json({ status: 'completed' })
}
