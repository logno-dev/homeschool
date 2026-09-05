import { NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { EMAIL_TYPES, type EmailType } from '@/lib/email-types'
import { NOTIFICATION_TYPES, type NotificationType, EMAIL_TEMPLATE_VARIABLES } from '@/lib/email-templates'
import { sendTestNotificationEmail } from '@/lib/email'

const sampleStatement = '<table style="border-collapse:collapse;width:100%"><tr><th style="padding:8px;border-bottom:1px solid #ccc;text-align:left">Description</th><th style="padding:8px;border-bottom:1px solid #ccc;text-align:right">Amount</th></tr><tr><td style="padding:8px">Fall 2026 registration fee</td><td style="padding:8px;text-align:right">$75.00</td></tr><tr><td style="padding:8px">Art Explorers</td><td style="padding:8px;text-align:right">$100.00</td></tr><tr><td style="padding:8px">Science Lab</td><td style="padding:8px;text-align:right">$75.00</td></tr><tr><td style="padding:8px;border-top:2px solid #333"><strong>Total</strong></td><td style="padding:8px;border-top:2px solid #333;text-align:right"><strong>$250.00</strong></td></tr><tr><td style="padding:8px">Payment received</td><td style="padding:8px;text-align:right">-$250.00</td></tr><tr><td style="padding:8px"><strong>Balance paid</strong></td><td style="padding:8px;text-align:right"><strong>$0.00</strong></td></tr></table>'
const sampleInvoice = sampleStatement.replace('Payment received</td><td style="padding:8px;text-align:right">-$250.00</td></tr><tr><td style="padding:8px"><strong>Balance paid</strong></td><td style="padding:8px;text-align:right"><strong>$0.00</strong>', 'Amount due</td><td style="padding:8px;text-align:right"><strong>$250.00</strong>')
const fakeValues: Record<string, string> = { firstName: 'Alex', familyName: 'Rivera Family', requesterName: 'Alex Rivera', name: 'Alex Rivera', email: 'alex@example.com', sessionName: 'Fall 2026 Session', classNames: 'Art Explorers, Science Lab', className: 'Art Explorers', description: 'A sample class description.', gradeRange: 'K-2', reason: 'Sample reason', resetUrl: 'https://example.com/reset-password', totalAmount: '$250.00', amountPaid: '$250.00', balanceDue: '$0.00', donationAmount: '$50.00', dueDate: 'October 1, 2026', billingStatement: sampleStatement, invoice: sampleInvoice }

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
