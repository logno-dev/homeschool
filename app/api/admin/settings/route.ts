import { NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { getGlobalSetting, getGradeIncrementSettings, incrementAllStudentGrades, setGlobalSetting, setGradeIncrementDate, setGradeIncrementLastRun } from '@/lib/database'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export async function GET() {
  try {
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const [settings, registrationNotificationEmails] = await Promise.all([
      getGradeIncrementSettings(),
      getGlobalSetting('registration_notification_emails')
    ])
    return NextResponse.json({ ...settings, registrationNotificationEmails: registrationNotificationEmails || '' })
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
    const { gradeIncrementDate, registrationNotificationEmails, runIncrementNow } = body

    if (runIncrementNow) {
      const result = await incrementAllStudentGrades()
      const today = new Date().toISOString().slice(0, 10)
      await setGradeIncrementLastRun(today)
      return NextResponse.json({ success: true, updated: result.updated, lastRun: today })
    }

    if (gradeIncrementDate && !DATE_REGEX.test(gradeIncrementDate)) {
      return NextResponse.json({ error: 'gradeIncrementDate must be YYYY-MM-DD' }, { status: 400 })
    }

    if (registrationNotificationEmails !== undefined && typeof registrationNotificationEmails !== 'string') {
      return NextResponse.json({ error: 'registrationNotificationEmails must be a comma-separated string' }, { status: 400 })
    }

    if (registrationNotificationEmails !== undefined) {
      const recipients = registrationNotificationEmails.split(',').map((email: string) => email.trim()).filter(Boolean)
      if (recipients.some((email: string) => !/^\S+@\S+\.\S+$/.test(email))) {
        return NextResponse.json({ error: 'All notification email addresses must be valid' }, { status: 400 })
      }
      await setGlobalSetting('registration_notification_emails', recipients.join(', '))
    }

    if (gradeIncrementDate !== undefined) {
      await setGradeIncrementDate(gradeIncrementDate || null)
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving admin settings:', error)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
