import { NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { getGlobalSetting, getGradeIncrementSettings, incrementAllStudentGrades, setGlobalSetting, setGradeIncrementDate, setGradeIncrementLastRun } from '@/lib/database'
import { DEFAULT_APP_TIMEZONE, isAppTimezone } from '@/lib/timezones'
import { EMAIL_TYPES, type EmailType } from '@/lib/email-types'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export async function GET() {
  try {
    const auth = await getAuthenticatedAdmin('settings')
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const [settings, registrationNotificationEmails, classRequestNotificationEmails, registrationOverrideNotificationEmails, handbookUrl, handbookVersion, supervisionFormUrl, supervisionFormFilename, appTimezone, senderAliases, ...senderSettings] = await Promise.all([
      getGradeIncrementSettings(),
      getGlobalSetting('registration_notification_emails'),
      getGlobalSetting('class_request_notification_emails'),
      getGlobalSetting('registration_override_notification_emails'),
      getGlobalSetting('handbook_url'),
      getGlobalSetting('handbook_version'),
      getGlobalSetting('supervision_form_url'),
      getGlobalSetting('supervision_form_filename'),
      getGlobalSetting('app_timezone'),
      getGlobalSetting('email_sender_aliases'),
      ...EMAIL_TYPES.flatMap((type) => [getGlobalSetting(`email_sender_${type}`), getGlobalSetting(`email_reply_to_${type}`)])
    ])
    return NextResponse.json({
      ...settings,
      registrationNotificationEmails: registrationNotificationEmails || '',
      classRequestNotificationEmails: classRequestNotificationEmails || '',
      registrationOverrideNotificationEmails: registrationOverrideNotificationEmails || '',
      handbookUrl: handbookUrl || '',
      handbookVersion: handbookVersion || '',
      supervisionFormUrl: supervisionFormUrl || '',
      supervisionFormFilename: supervisionFormFilename || '',
      appTimezone: isAppTimezone(appTimezone) ? appTimezone : DEFAULT_APP_TIMEZONE,
      emailSenderAliases: (() => { try { return JSON.parse(senderAliases || '[]') } catch { return [] } })(),
      emailSenders: Object.fromEntries(EMAIL_TYPES.map((type, index) => [type, senderSettings[index * 2] || ''])),
      emailReplyTos: Object.fromEntries(EMAIL_TYPES.map((type, index) => [type, senderSettings[index * 2 + 1] || '']))
    })
  } catch (error) {
    console.error('Error loading admin settings:', error)
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedAdmin('settings')
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json()
    const { gradeIncrementDate, registrationNotificationEmails, classRequestNotificationEmails, registrationOverrideNotificationEmails, handbookUrl, handbookVersion, appTimezone, emailSenderAliases, emailSenders, emailReplyTos, runIncrementNow } = body

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

    if (classRequestNotificationEmails !== undefined && typeof classRequestNotificationEmails !== 'string') {
      return NextResponse.json({ error: 'classRequestNotificationEmails must be a comma-separated string' }, { status: 400 })
    }

    if (registrationOverrideNotificationEmails !== undefined && typeof registrationOverrideNotificationEmails !== 'string') {
      return NextResponse.json({ error: 'registrationOverrideNotificationEmails must be a comma-separated string' }, { status: 400 })
    }

    if (appTimezone !== undefined && !isAppTimezone(appTimezone)) {
      return NextResponse.json({ error: 'appTimezone must be a supported timezone' }, { status: 400 })
    }

    if (emailSenderAliases !== undefined && (!Array.isArray(emailSenderAliases) || emailSenderAliases.some((alias) => typeof alias !== 'string' || !/^[a-z0-9][a-z0-9._-]*$/i.test(alias)))) {
      return NextResponse.json({ error: 'emailSenderAliases must contain valid email local-parts' }, { status: 400 })
    }
    if (emailSenders !== undefined && (typeof emailSenders !== 'object' || emailSenders === null || Object.entries(emailSenders).some(([type, alias]) => !EMAIL_TYPES.includes(type as EmailType) || typeof alias !== 'string'))) {
      return NextResponse.json({ error: 'emailSenders contains an invalid sender selection' }, { status: 400 })
    }
    if (emailReplyTos !== undefined && (typeof emailReplyTos !== 'object' || emailReplyTos === null || Object.entries(emailReplyTos).some(([type, alias]) => !EMAIL_TYPES.includes(type as EmailType) || typeof alias !== 'string'))) {
      return NextResponse.json({ error: 'emailReplyTos contains an invalid reply-to selection' }, { status: 400 })
    }

    if (handbookUrl !== undefined && typeof handbookUrl !== 'string') {
      return NextResponse.json({ error: 'handbookUrl must be a PDF URL' }, { status: 400 })
    }

    if (handbookVersion !== undefined && typeof handbookVersion !== 'string') {
      return NextResponse.json({ error: 'handbookVersion must be a string' }, { status: 400 })
    }

    if (handbookUrl !== undefined || handbookVersion !== undefined) {
      const normalizedHandbookUrl = String(handbookUrl || '').trim()
      const normalizedHandbookVersion = String(handbookVersion || '').trim()
      if ((normalizedHandbookUrl && !normalizedHandbookVersion) || (!normalizedHandbookUrl && normalizedHandbookVersion)) {
        return NextResponse.json({ error: 'Handbook URL and version must be configured together' }, { status: 400 })
      }
      if (normalizedHandbookUrl && !(/^(https?:\/\/|\/)/.test(normalizedHandbookUrl))) {
        return NextResponse.json({ error: 'Handbook URL must be an HTTP(S) or site-relative URL' }, { status: 400 })
      }
      await Promise.all([
        setGlobalSetting('handbook_url', normalizedHandbookUrl || null),
        setGlobalSetting('handbook_version', normalizedHandbookVersion || null)
      ])
    }

    if (registrationNotificationEmails !== undefined) {
      const recipients = registrationNotificationEmails.split(',').map((email: string) => email.trim()).filter(Boolean)
      if (recipients.some((email: string) => !/^\S+@\S+\.\S+$/.test(email))) {
        return NextResponse.json({ error: 'All notification email addresses must be valid' }, { status: 400 })
      }
      await setGlobalSetting('registration_notification_emails', recipients.join(', '))
    }

    if (classRequestNotificationEmails !== undefined) {
      const recipients = classRequestNotificationEmails.split(',').map((email: string) => email.trim()).filter(Boolean)
      if (recipients.some((email: string) => !/^\S+@\S+\.\S+$/.test(email))) {
        return NextResponse.json({ error: 'All class request notification email addresses must be valid' }, { status: 400 })
      }
      await setGlobalSetting('class_request_notification_emails', recipients.join(', '))
    }

    if (registrationOverrideNotificationEmails !== undefined) {
      const recipients = registrationOverrideNotificationEmails.split(',').map((email: string) => email.trim()).filter(Boolean)
      if (recipients.some((email: string) => !/^\S+@\S+\.\S+$/.test(email))) {
        return NextResponse.json({ error: 'All registration override notification addresses must be valid' }, { status: 400 })
      }
      await setGlobalSetting('registration_override_notification_emails', recipients.join(', '))
    }

    if (gradeIncrementDate !== undefined) {
      await setGradeIncrementDate(gradeIncrementDate || null)
    }
    if (appTimezone !== undefined) await setGlobalSetting('app_timezone', appTimezone)
    if (emailSenderAliases !== undefined) await setGlobalSetting('email_sender_aliases', JSON.stringify(Array.from(new Set(emailSenderAliases))))
    if (emailSenders !== undefined) await Promise.all(EMAIL_TYPES.map((type) => setGlobalSetting(`email_sender_${type}`, emailSenders[type] || null)))
    if (emailReplyTos !== undefined) await Promise.all(EMAIL_TYPES.map((type) => setGlobalSetting(`email_reply_to_${type}`, emailReplyTos[type] || null)))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving admin settings:', error)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
