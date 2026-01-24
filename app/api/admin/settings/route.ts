import { NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { getGradeIncrementSettings, incrementAllStudentGrades, setGradeIncrementDate, setGradeIncrementLastRun } from '@/lib/database'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export async function GET() {
  try {
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const settings = await getGradeIncrementSettings()
    return NextResponse.json(settings)
  } catch (error) {
    console.error('Error loading admin settings:', error)
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json()
    const { gradeIncrementDate, runIncrementNow } = body

    if (runIncrementNow) {
      const result = await incrementAllStudentGrades()
      const today = new Date().toISOString().slice(0, 10)
      await setGradeIncrementLastRun(today)
      return NextResponse.json({ success: true, updated: result.updated, lastRun: today })
    }

    if (gradeIncrementDate && !DATE_REGEX.test(gradeIncrementDate)) {
      return NextResponse.json({ error: 'gradeIncrementDate must be YYYY-MM-DD' }, { status: 400 })
    }

    await setGradeIncrementDate(gradeIncrementDate || null)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving admin settings:', error)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
