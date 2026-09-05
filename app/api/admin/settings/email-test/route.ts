import { NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { EMAIL_TYPES, type EmailType } from '@/lib/email-types'
import { NOTIFICATION_TYPES, type NotificationType, EMAIL_TEMPLATE_VARIABLES } from '@/lib/email-templates'
import { sendTestNotificationEmail } from '@/lib/email'

const fakeValues: Record<string, string> = { firstName: 'Alex', familyName: 'Rivera Family', requesterName: 'Alex Rivera', name: 'Alex Rivera', email: 'alex@example.com', sessionName: 'Fall 2026 Session', classNames: 'Art Explorers, Science Lab', className: 'Art Explorers', description: 'A sample class description.', gradeRange: 'K-2', reason: 'Sample reason', resetUrl: 'https://example.com/reset-password', totalAmount: '$250.00', amountPaid: '$250.00', balanceDue: '$0.00', donationAmount: '$50.00', dueDate: 'October 1, 2026', billingStatement: '<p>Sample billing statement</p>', invoice: '<p>Sample invoice</p>' }

export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedAdmin('settings')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const body = await request.json() as { type?: string; to?: string; subject?: string; template?: string }
    const type = body.type as NotificationType
    if (!NOTIFICATION_TYPES.includes(type) || !EMAIL_TYPES.includes(type as EmailType)) return NextResponse.json({ error: 'Invalid notification type' }, { status: 400 })
    if (!body.to || !/^\S+@\S+\.\S+$/.test(body.to)) return NextResponse.json({ error: 'Enter a valid test recipient email address' }, { status: 400 })
    if (typeof body.template !== 'string' || typeof body.subject !== 'string') return NextResponse.json({ error: 'Subject and template are required' }, { status: 400 })
    const variables = Object.fromEntries(EMAIL_TEMPLATE_VARIABLES[type].map((key) => [key, fakeValues[key] || `[${key}]`]))
    await sendTestNotificationEmail({ type, to: body.to, subject: body.subject, template: body.template, variables })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error sending notification test email:', error)
    return NextResponse.json({ error: 'Failed to send test email' }, { status: 500 })
  }
}
