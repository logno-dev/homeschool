'use client'

import dynamic from 'next/dynamic'
import { Fragment, useState } from 'react'
import { EMAIL_TEMPLATE_VARIABLES, NOTIFICATION_TYPES, type NotificationType } from '@/lib/email-templates'

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false })

type NotificationSettings = {
  registrationNotificationEmails: string
  classRequestNotificationEmails: string
  registrationOverrideNotificationEmails: string
  emailSenderAliases: string
  emailSenders: Record<string, string>
  emailReplyTos: Record<string, string>
  emailCcs: Record<string, string>
  emailBccs: Record<string, string>
  emailTemplates: Record<string, string>
  emailSubjects: Record<string, string>
}

const labels: Record<NotificationType, string> = {
  password_reset: 'Password Reset',
  registration_notification: 'New Account Notification',
  pending_activation: 'Pending Activation',
  account_approved: 'Account Approved',
  class_request: 'Class Request Notification',
  registration_override: 'Registration Override Notification',
  registration_confirmation: 'Registration Confirmation',
  payment_confirmation: 'Payment Confirmation',
  payment_invoice: 'Payment Invoice',
  donation_confirmation: 'Donation Confirmation'
}

const recipientFields: Partial<Record<NotificationType, keyof NotificationSettings>> = {
  registration_notification: 'registrationNotificationEmails',
  class_request: 'classRequestNotificationEmails',
  registration_override: 'registrationOverrideNotificationEmails'
}

const sampleStatement = '<table style="border-collapse:collapse;width:100%"><tr><th style="padding:8px;border-bottom:1px solid #ccc;text-align:left">Description</th><th style="padding:8px;border-bottom:1px solid #ccc;text-align:right">Amount</th></tr><tr><td style="padding:8px">Fall 2026 registration fee</td><td style="padding:8px;text-align:right">$75.00</td></tr><tr><td style="padding:8px">Art Explorers</td><td style="padding:8px;text-align:right">$100.00</td></tr><tr><td style="padding:8px">Science Lab</td><td style="padding:8px;text-align:right">$75.00</td></tr><tr><td style="padding:8px;border-top:2px solid #333"><strong>Total</strong></td><td style="padding:8px;border-top:2px solid #333;text-align:right"><strong>$250.00</strong></td></tr><tr><td style="padding:8px">Payment received</td><td style="padding:8px;text-align:right">-$250.00</td></tr><tr><td style="padding:8px"><strong>Balance paid</strong></td><td style="padding:8px;text-align:right"><strong>$0.00</strong></td></tr></table>'
const sampleInvoice = sampleStatement.replace('Payment received</td><td style="padding:8px;text-align:right">-$250.00</td></tr><tr><td style="padding:8px"><strong>Balance paid</strong></td><td style="padding:8px;text-align:right"><strong>$0.00</strong>', 'Amount due</td><td style="padding:8px;text-align:right"><strong>$250.00</strong>')
const fakeValues: Record<string, string> = {
  firstName: 'Alex', familyName: 'Rivera Family', requesterName: 'Alex Rivera', name: 'Alex Rivera', email: 'alex@example.com',
  sessionName: 'Fall 2026 Session', classNames: 'Art Explorers, Science Lab', className: 'Art Explorers', description: 'A sample class description.',
  gradeRange: 'K-2', reason: 'Sample reason', resetUrl: 'https://example.com/reset-password', totalAmount: '$250.00', amountPaid: '$250.00',
  balanceDue: '$0.00', donationAmount: '$50.00', dueDate: 'October 1, 2026', billingStatement: sampleStatement, invoice: sampleInvoice
}

export default function NotificationSettingsPanel({ settings, setSettings, onSave, isSaving }: { settings: NotificationSettings; setSettings: (updater: (current: NotificationSettings) => NotificationSettings) => void; onSave: () => void; isSaving: boolean }) {
  const [testType, setTestType] = useState<NotificationType | null>(null)
  const [testEmail, setTestEmail] = useState('')
  const [message, setMessage] = useState('')
  const aliases = settings.emailSenderAliases.split(',').map((alias) => alias.trim()).filter(Boolean)
  const update = (key: keyof NotificationSettings, value: string) => setSettings((current) => ({ ...current, [key]: value }))
  const updateMap = (key: 'emailSenders' | 'emailReplyTos' | 'emailCcs' | 'emailBccs' | 'emailTemplates' | 'emailSubjects', type: string, value: string) => setSettings((current) => ({ ...current, [key]: { ...current[key], [type]: value } }))
  const valuesFor = (type: NotificationType) => Object.fromEntries(EMAIL_TEMPLATE_VARIABLES[type].map((key) => [key, fakeValues[key] || `[${key}]`]))
  const preview = (type: NotificationType) => {
    const values = valuesFor(type)
    const template = settings.emailTemplates[type] || `<p>Hello {{firstName}},</p><p>This is a test of the ${type.replace(/_/g, ' ')} notification.</p>`
    const html = template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => values[key] || `{{${key}}}`)
    const popup = window.open('', '_blank', 'width=760,height=700')
    if (popup) {
      popup.document.write(`<title>Notification Preview</title><body style="font-family:Arial,sans-serif;padding:32px">${html}</body>`)
      popup.document.close()
    }
  }
  const sendTest = async () => {
    if (!testType) return
    setMessage('Sending...')
    const response = await fetch('/api/admin/settings/email-test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: testType, to: testEmail, subject: settings.emailSubjects[testType] || '', template: settings.emailTemplates[testType] || '' }) })
    const result = await response.json()
    setMessage(result.success ? 'Test email sent.' : result.error || 'Failed to send test email.')
    if (result.success) setTestType(null)
  }

  return <div className="space-y-6">
    <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
      <h2 className="font-semibold text-blue-900">Notification Email Settings</h2>
      <p className="mt-1 text-sm text-blue-800">Configure recipients, sender addresses, reply-to addresses, CC/BCC recipients, and content for each system notification. Save changes when finished.</p>
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700">Sender aliases</label>
      <input type="text" value={settings.emailSenderAliases} onChange={(event) => update('emailSenderAliases', event.target.value)} placeholder="noreply, announcements, payments" className="mt-1 w-full max-w-xl rounded-md border border-gray-300 px-3 py-2 text-sm" />
      <p className="mt-2 text-xs text-gray-500">Enter comma-separated local parts for your verified email domain.</p>
    </div>
    {NOTIFICATION_TYPES.map((type) => {
      const recipientKey = recipientFields[type]
      return <Fragment key={type}>
        {type === 'registration_notification' && <h2 className="pt-3 text-xl font-semibold text-gray-900">Admin and Staff Notifications</h2>}
        {type === 'password_reset' && <h2 className="pt-3 text-xl font-semibold text-gray-900">User Notifications</h2>}
        <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">{labels[type]}</h2>
          {recipientKey && <input type="text" value={String(settings[recipientKey] || '')} onChange={(event) => update(recipientKey, event.target.value)} placeholder="admin@example.com, staff@example.com" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />}
          <label className="block text-sm font-medium text-gray-700">Sender address
            <select value={settings.emailSenders[type] || ''} onChange={(event) => updateMap('emailSenders', type, event.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="">Default sender</option>{aliases.map((alias) => <option key={alias} value={alias}>{alias}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-gray-700">Reply-to address
            <input type="text" value={settings.emailReplyTos[type] || ''} onChange={(event) => updateMap('emailReplyTos', type, event.target.value)} placeholder="Optional email local-part" className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </label>
          <label className="block text-sm font-medium text-gray-700">CC recipients
            <input type="text" value={settings.emailCcs[type] || ''} onChange={(event) => updateMap('emailCcs', type, event.target.value)} placeholder="Optional, comma-separated email addresses" className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </label>
          <label className="block text-sm font-medium text-gray-700">BCC recipients
            <input type="text" value={settings.emailBccs[type] || ''} onChange={(event) => updateMap('emailBccs', type, event.target.value)} placeholder="Optional, comma-separated email addresses" className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </label>
          <label className="block text-sm font-medium text-gray-700">Subject line
            <input type="text" value={settings.emailSubjects[type] || ''} onChange={(event) => updateMap('emailSubjects', type, event.target.value)} placeholder="Leave blank to use the default subject" className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </label>
          <div>
            <label className="block text-sm font-medium text-gray-700">Message template</label>
            <div className="mt-1"><ReactQuill theme="snow" value={settings.emailTemplates[type] || ''} onChange={(value) => updateMap('emailTemplates', type, value)} /></div>
            <p className="mt-2 text-xs text-gray-500">Available variables: {EMAIL_TEMPLATE_VARIABLES[type].map((key) => `{{${key}}}`).join(', ')}</p>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" onClick={() => preview(type)} className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700">Preview</button>
            <button type="button" onClick={() => { setTestType(type); setTestEmail(''); setMessage('') }} className="rounded-md border border-blue-300 px-3 py-2 text-sm font-medium text-blue-700">Send test</button>
          </div>
          {testType === type && <div className="flex flex-wrap items-center gap-2 rounded-md bg-gray-50 p-3"><input type="email" value={testEmail} onChange={(event) => setTestEmail(event.target.value)} placeholder="test@example.com" className="rounded-md border border-gray-300 px-3 py-2 text-sm" /><button type="button" onClick={sendTest} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white">Send</button>{message && <span className="text-sm text-gray-600">{message}</span>}</div>}
        </section>
      </Fragment>
    })}
    <div className="flex justify-end"><button type="button" onClick={onSave} disabled={isSaving} className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50">{isSaving ? 'Saving...' : 'Save notification settings'}</button></div>
  </div>
}
