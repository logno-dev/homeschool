import { NextResponse } from 'next/server'
import { getGradeIncrementSettings, incrementAllStudentGrades, setGradeIncrementLastRun } from '@/lib/database'

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

  const { incrementDate, lastRun } = await getGradeIncrementSettings()
  if (!incrementDate) {
    return NextResponse.json({ status: 'skipped', reason: 'No increment date set' })
  }

  const today = new Date().toISOString().slice(0, 10)
  if (today !== incrementDate) {
    return NextResponse.json({ status: 'skipped', reason: 'Not increment date' })
  }

  if (lastRun === today) {
    return NextResponse.json({ status: 'skipped', reason: 'Already ran today' })
  }

  const result = await incrementAllStudentGrades()
  await setGradeIncrementLastRun(today)

  return NextResponse.json({ status: 'completed', updated: result.updated })
}
