import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { getGlobalSetting } from '@/lib/database'
import { globalSettings } from '@/lib/schema'
import { type EmailType } from '@/lib/email-types'
import { createFeePdf } from '@/lib/fee-pdf'
import { put } from '@vercel/blob'
import { userDocuments, guardians } from '@/lib/schema'
import { randomUUID } from 'crypto'

async function getEmailContent(type: EmailType, fallbackHtml: string, fallbackText: string, variables: Record<string, string>, rawHtmlVariables: string[] = []) {
  const [setting] = await db.select({ value: globalSettings.value }).from(globalSettings).where(eq(globalSettings.key, `email_template_${type}`)).limit(1)
  if (!setting?.value) return { html: fallbackHtml, text: fallbackText }
  const render = (content: string) => content.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => rawHtmlVariables.includes(key) ? variables[key] ?? `{{${key}}}` : escapeHtml(variables[key] ?? `{{${key}}}`))
  const html = render(setting.value)
  return { html, text: html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() }
}

export async function sendTestNotificationEmail(input: { type: EmailType; to: string; subject?: string; template?: string; variables: Record<string, string> }) {
  const template = input.template?.trim() || `<div><p>Hello {{firstName}},</p><p>This is a test of the ${input.type.replace(/_/g, ' ')} notification.</p></div>`
  const rawVariables = input.type === 'payment_invoice' ? ['invoice'] : input.type === 'payment_confirmation' || input.type === 'donation_confirmation' ? ['billingStatement'] : []
  const content = await getEmailContent(input.type, template, template.replace(/<[^>]+>/g, ''), input.variables, rawVariables)
  const pdfDetails = await getInvoicePdfDetails()
  const attachments = input.type === 'donation_confirmation' ? [{ filename: 'DVCLC-Donation-Receipt.pdf', content: createFeePdf({ title: 'DVCLC Donation Receipt', familyName: input.variables.familyName || 'Rivera Family', guardians: 'Alex Rivera, Jordan Rivera', sessionName: 'Scholarship Fund', totalAmount: 50, amountPaid: 50, balanceDue: 0, ...pdfDetails, footer: (await getGlobalSetting('invoiceDonationStatement')) || undefined }) }] : input.type === 'payment_confirmation' ? [{ filename: 'DVCLC-Billing-Statement.pdf', content: createFeePdf({ title: 'DVCLC Billing Statement', familyName: input.variables.familyName || 'Rivera Family', guardians: 'Alex Rivera, Jordan Rivera', sessionName: input.variables.sessionName || 'Fall 2026 Session', totalAmount: 250, amountPaid: 250, balanceDue: 0, ...pdfDetails }) }] : input.type === 'payment_invoice' ? [{ filename: 'DVCLC-Invoice.pdf', content: createFeePdf({ title: 'DVCLC Invoice', familyName: input.variables.familyName || 'Rivera Family', guardians: 'Alex Rivera, Jordan Rivera', sessionName: input.variables.sessionName || 'Fall 2026 Session', totalAmount: 250, amountPaid: 0, balanceDue: 250, dueDate: input.variables.dueDate, ...pdfDetails }) }] : undefined
  await sendEmail({ to: input.to, subject: input.subject?.trim() || `DVCLC ${input.type.replace(/_/g, ' ')}`, html: content.html, text: content.text, type: input.type, attachments })
}

async function getEmailSubject(type: EmailType, fallback: string, variables: Record<string, string>) {
  const [setting] = await db.select({ value: globalSettings.value }).from(globalSettings).where(eq(globalSettings.key, `email_subject_${type}`)).limit(1)
  return (setting?.value || fallback).replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => variables[key] ?? `{{${key}}}`)
}

type PasswordResetEmailInput = {
  to: string
  resetUrl: string
}

type RegistrationNotificationEmailInput = {
  recipients: string[]
  firstName: string
  lastName: string
  email: string
}

type UserAccountEmailInput = {
  to: string
  firstName: string
}

type ClassRequestNotificationEmailInput = {
  recipients: string[]
  firstName: string
  lastName: string
  email: string
  className: string
  description: string
  gradeRange: string
  sessionName: string
}

type RegistrationOverrideNotificationEmailInput = {
  recipients: string[]
  firstName: string
  lastName: string
  email: string
  sessionName: string
  reason: string
  classNames: string
}

type RegistrationConfirmationEmailInput = { to: string; firstName: string; sessionName: string; classNames: string; totalAmount: number; amountPaid: number; balanceDue: number }
type PaymentNotificationEmailInput = { to: string; firstName: string; familyName: string; sessionName: string; totalAmount: number; amountPaid: number; balanceDue: number; dueDate?: string; billingStatement?: string; invoice?: string; userId?: string; familyId?: string }
type DonationConfirmationEmailInput = { to: string; firstName: string; familyName: string; donationAmount: number; billingStatement: string; userId?: string; familyId?: string }

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

async function sendEmail(input: {
  to: string | string[]
  subject: string
  html: string
  text: string
  type: EmailType
  senderAlias?: string
  replyToAlias?: string
  cc?: string[]
  bcc?: string[]
  attachments?: Array<{ filename: string; content: string }>
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const from = await getConfiguredSender(input.type, input.senderAlias)
  const replyTo = await getConfiguredReplyTo(input.type, input.replyToAlias)
  const [cc, bcc] = await Promise.all([
    getConfiguredRecipients(input.type, 'cc'),
    getConfiguredRecipients(input.type, 'bcc')
  ])

  if (!apiKey || !from) {
    throw new Error('RESEND_API_KEY and RESEND_EMAIL_DOMAIN must be configured in the active deployment environment')
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      ...(replyTo ? { reply_to: replyTo } : {}),
      to: input.to,
      ...(cc.length ? { cc } : {}),
      ...(bcc.length ? { bcc } : {}),
      ...(input.cc?.length ? { cc: input.cc } : {}),
      ...(input.bcc?.length ? { bcc: input.bcc } : {}),
      subject: input.subject,
      html: input.html,
      text: input.text
      , ...(input.attachments?.length ? { attachments: input.attachments } : {})
    })
  })

  if (!response.ok) {
    const payload = await response.text()
    throw new Error(`Resend email failed (${response.status}): ${payload}`)
  }
}

async function getConfiguredRecipients(type: EmailType, kind: 'cc' | 'bcc'): Promise<string[]> {
  const setting = await getGlobalSetting(`email_${kind}_${type}`)
  return (setting || '').split(',').map((email) => email.trim()).filter(Boolean)
}

async function getConfiguredSender(type: EmailType, overrideAlias?: string) {
  const configuredDomain = process.env.RESEND_EMAIL_DOMAIN || process.env.RESEND_FROM_EMAIL?.replace(/^[^@]+/, '')
  if (!configuredDomain) return null
  const domain = configuredDomain.startsWith('@') ? configuredDomain.slice(1) : configuredDomain
  const [aliasesSetting, senderSetting] = await Promise.all([
    db.select({ value: globalSettings.value }).from(globalSettings).where(eq(globalSettings.key, 'email_sender_aliases')).limit(1),
    db.select({ value: globalSettings.value }).from(globalSettings).where(eq(globalSettings.key, `email_sender_${type}`)).limit(1)
  ])
  let aliases: string[] = []
  try { aliases = JSON.parse(aliasesSetting[0]?.value || '[]') as string[] } catch { aliases = [] }
  const alias = overrideAlias || senderSetting[0]?.value || aliases[0] || 'noreply'
  return `${alias}@${domain}`
}

async function getConfiguredReplyTo(type: EmailType, overrideAlias?: string) {
  const configuredDomain = process.env.RESEND_EMAIL_DOMAIN || process.env.RESEND_FROM_EMAIL?.replace(/^[^@]+/, '')
  if (!configuredDomain) return null
  const domain = configuredDomain.startsWith('@') ? configuredDomain.slice(1) : configuredDomain
  const [setting] = await db.select({ value: globalSettings.value }).from(globalSettings).where(eq(globalSettings.key, `email_reply_to_${type}`)).limit(1)
  const alias = overrideAlias || setting?.value
  return alias ? `${alias}@${domain}` : null
}

export async function sendNewsletterBatch(input: {
  subject: string
  html: string
  text: string
  recipients: Array<{ email: string; firstName: string; lastName: string }>
  senderAlias?: string
  replyToAlias?: string
}): Promise<string[]> {
  if (input.recipients.length > 100) {
    throw new Error('Newsletter batches cannot exceed 100 recipients')
  }

  const apiKey = process.env.RESEND_API_KEY
  const from = await getConfiguredSender('newsletter', input.senderAlias)
  const replyTo = await getConfiguredReplyTo('newsletter', input.replyToAlias)
  if (!apiKey || !from) throw new Error('RESEND_API_KEY and RESEND_EMAIL_DOMAIN must be configured in the active deployment environment')

  const response = await fetch('https://api.resend.com/emails/batch', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      emails: input.recipients.map((recipient) => ({
        from,
        ...(replyTo ? { reply_to: replyTo } : {}),
        to: [recipient.email],
        subject: input.subject,
        html: input.html,
        text: input.text
      }))
    })
  })

  if (!response.ok) {
    const payload = await response.text()
    throw new Error(`Resend newsletter batch failed (${response.status}): ${payload}`)
  }

  const payload = await response.json() as { data?: Array<{ id?: string }> }
  return (payload.data || []).map((entry) => entry.id || '')
}

export async function sendPasswordResetEmail(input: PasswordResetEmailInput): Promise<void> {
  const escapedUrl = escapeHtml(input.resetUrl)
  const content = await getEmailContent('password_reset', `<div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;"><h2>Reset your DVCLC password</h2><p>We received a request to reset your password.</p><p><a href="${escapedUrl}">Reset password</a></p><p>Use this link: ${escapedUrl}</p></div>`, `We received a request to reset your DVCLC password.\n\nUse this link to reset your password:\n${input.resetUrl}`, { resetUrl: input.resetUrl })

  await sendEmail({
    to: input.to,
    subject: await getEmailSubject('password_reset', 'Reset your DVCLC password', { resetUrl: input.resetUrl }),
    text: content.text,
    html: content.html,
    type: 'password_reset'
  })
}

export async function sendRegistrationNotificationEmail(input: RegistrationNotificationEmailInput): Promise<void> {
  const name = `${input.firstName} ${input.lastName}`.trim()
  const escapedName = escapeHtml(name)
  const escapedEmail = escapeHtml(input.email)
  const content = await getEmailContent('registration_notification', `<div><h2>New DVCLC account awaiting approval</h2><p><strong>Name:</strong> ${escapedName}</p><p><strong>Email:</strong> ${escapedEmail}</p></div>`, `A new DVCLC account is awaiting approval.\n\nName: ${name}\nEmail: ${input.email}`, { name, email: input.email })

  await sendEmail({
    to: input.recipients,
    subject: await getEmailSubject('registration_notification', 'New DVCLC account awaiting approval', { name, email: input.email }),
    text: content.text,
    html: content.html,
    type: 'registration_notification'
  })
}

export async function sendPendingActivationEmail(input: UserAccountEmailInput): Promise<void> {
  const escapedName = escapeHtml(input.firstName)
  const content = await getEmailContent('pending_activation', `<div><h2>Your DVCLC account is pending activation</h2><p>Hello ${escapedName},</p><p>Thank you for registering for DVCLC. An administrator is reviewing your account.</p></div>`, `Hello ${input.firstName},\n\nThank you for registering for DVCLC. An administrator is reviewing your account.`, { firstName: input.firstName })

  await sendEmail({
    to: input.to,
    subject: await getEmailSubject('pending_activation', 'Your DVCLC account is pending activation', { firstName: input.firstName }),
    text: content.text,
    html: content.html,
    type: 'pending_activation'
  })
}

export async function sendAccountApprovedEmail(input: UserAccountEmailInput): Promise<void> {
  const escapedName = escapeHtml(input.firstName)
  const content = await getEmailContent('account_approved', `<div><h2>Your DVCLC account has been approved</h2><p>Hello ${escapedName},</p><p>Your DVCLC account has been approved. You can now sign in.</p></div>`, `Hello ${input.firstName},\n\nYour DVCLC account has been approved. You can now sign in.`, { firstName: input.firstName })

  await sendEmail({
    to: input.to,
    subject: await getEmailSubject('account_approved', 'Your DVCLC account has been approved', { firstName: input.firstName }),
    text: content.text,
    html: content.html,
    type: 'account_approved'
  })
}

export async function sendClassRequestNotificationEmail(input: ClassRequestNotificationEmailInput): Promise<void> {
  const applicantName = `${input.firstName} ${input.lastName}`.trim()
  const escapedApplicantName = escapeHtml(applicantName)
  const escapedEmail = escapeHtml(input.email)
  const escapedClassName = escapeHtml(input.className)
  const escapedDescription = escapeHtml(input.description)
  const escapedGradeRange = escapeHtml(input.gradeRange)
  const escapedSessionName = escapeHtml(input.sessionName)
  const content = await getEmailContent('class_request', `<div><h2>New class teaching request</h2><p><strong>Parent:</strong> ${escapedApplicantName} (${escapedEmail})</p><p><strong>Class:</strong> ${escapedClassName}</p><p><strong>Session:</strong> ${escapedSessionName}</p><p><strong>Grade range:</strong> ${escapedGradeRange}</p><p><strong>Description:</strong><br/>${escapedDescription}</p></div>`, `A new class teaching request was submitted.\n\nParent: ${applicantName} (${input.email})\nClass: ${input.className}\nSession: ${input.sessionName}\nGrade range: ${input.gradeRange}\n\nDescription:\n${input.description}`, { applicantName, email: input.email, className: input.className, description: input.description, gradeRange: input.gradeRange, sessionName: input.sessionName })

  await sendEmail({
    to: input.recipients,
    subject: await getEmailSubject('class_request', `New class teaching request: ${input.className}`, { applicantName, email: input.email, className: input.className, description: input.description, gradeRange: input.gradeRange, sessionName: input.sessionName }),
    text: content.text,
    html: content.html,
    type: 'class_request'
  })
}

export async function sendRegistrationOverrideNotificationEmail(input: RegistrationOverrideNotificationEmailInput): Promise<void> {
  const requester = `${input.firstName} ${input.lastName}`.trim()
  const content = await getEmailContent('registration_override', `<div><p><strong>${escapeHtml(requester)}</strong> (${escapeHtml(input.email)}) requested a registration override for <strong>${escapeHtml(input.sessionName)}</strong>.</p><p>Classes: ${escapeHtml(input.classNames || 'Selected classes')}</p><p>Reason: ${escapeHtml(input.reason)}</p></div>`, `${requester} (${input.email}) requested a registration override for ${input.sessionName}.\nClasses: ${input.classNames || 'Selected classes'}\nReason: ${input.reason}`, { requesterName: requester, email: input.email, sessionName: input.sessionName, classNames: input.classNames || 'Selected classes', reason: input.reason })
  await sendEmail({
    to: input.recipients,
    subject: await getEmailSubject('registration_override', `Registration override requested: ${requester}`, { requesterName: requester, email: input.email, sessionName: input.sessionName, classNames: input.classNames || 'Selected classes', reason: input.reason }),
    html: content.html,
    text: content.text,
    type: 'registration_override'
  })
}

function statementHtml(input: { familyName?: string; sessionName: string; totalAmount: number; amountPaid: number; balanceDue: number; dueDate?: string; paid: boolean }) {
  return `<table style="border-collapse:collapse"><tr><td style="padding:4px 16px 4px 0"><strong>Family</strong></td><td>${escapeHtml(input.familyName || '')}</td></tr><tr><td style="padding:4px 16px 4px 0"><strong>Session</strong></td><td>${escapeHtml(input.sessionName)}</td></tr><tr><td style="padding:4px 16px 4px 0"><strong>Total</strong></td><td>$${input.totalAmount.toFixed(2)}</td></tr><tr><td style="padding:4px 16px 4px 0"><strong>Paid</strong></td><td>$${input.amountPaid.toFixed(2)}</td></tr><tr><td style="padding:4px 16px 4px 0"><strong>${input.paid ? 'Balance paid' : 'Balance due'}</strong></td><td>$${input.balanceDue.toFixed(2)}</td></tr>${input.dueDate ? `<tr><td style="padding:4px 16px 4px 0"><strong>Due date</strong></td><td>${escapeHtml(input.dueDate)}</td></tr>` : ''}</table>`
}

async function storeUserPdf(input: PaymentNotificationEmailInput, filename: string, documentType: string, content: string) {
  if (!input.userId || !input.familyId) return
  const bytes = Buffer.from(content, 'base64')
  const blob = await put(`user-documents/${input.familyId}/${randomUUID()}-${filename}`, bytes, { access: 'public', addRandomSuffix: false, contentType: 'application/pdf' })
  await db.insert(userDocuments).values({ id: randomUUID(), userId: input.userId, familyId: input.familyId, filename, documentType, blobUrl: blob.url, pathname: blob.pathname, size: bytes.length })
}

async function getInvoicePdfDetails() {
  const keys = ['invoiceOrganizationName', 'invoiceOrganizationAddress', 'invoiceOrganizationCity', 'invoiceOrganizationState', 'invoiceOrganizationPostalCode', 'invoiceOrganizationPhone', 'invoiceOrganizationEmail', 'invoiceOrganizationWebsite', 'invoicePaymentInstructions', 'invoiceDonationStatement']
  const values = await Promise.all(keys.map((key) => getGlobalSetting(key)))
  const settings = Object.fromEntries(keys.map((key, index) => [key, values[index] || '']))
  return {
    organization: settings.invoiceOrganizationName,
    organizationAddress: [settings.invoiceOrganizationAddress, [settings.invoiceOrganizationCity, settings.invoiceOrganizationState, settings.invoiceOrganizationPostalCode].filter(Boolean).join(', ')].filter(Boolean).join(', '),
    organizationContact: [settings.invoiceOrganizationPhone, settings.invoiceOrganizationEmail, settings.invoiceOrganizationWebsite].filter(Boolean).join(' | '),
    footer: settings.invoicePaymentInstructions
  }
}

async function getFamilyGuardians(familyId: string | undefined) {
  if (!familyId) return undefined
  const familyGuardians = await db.select({ firstName: guardians.firstName, lastName: guardians.lastName }).from(guardians).where(eq(guardians.familyId, familyId))
  return familyGuardians.map((guardian) => `${guardian.firstName} ${guardian.lastName}`).join(', ') || undefined
}

export async function sendRegistrationConfirmationEmail(input: RegistrationConfirmationEmailInput) {
  const variables = { firstName: input.firstName, sessionName: input.sessionName, classNames: input.classNames, totalAmount: `$${input.totalAmount.toFixed(2)}`, amountPaid: `$${input.amountPaid.toFixed(2)}`, balanceDue: `$${input.balanceDue.toFixed(2)}` }
  const content = await getEmailContent('registration_confirmation', `<div><p>Hello ${escapeHtml(input.firstName)},</p><p>Your registration for ${escapeHtml(input.sessionName)} is complete.</p><p>Classes: ${escapeHtml(input.classNames)}</p><p>Amount due: $${input.balanceDue.toFixed(2)}</p></div>`, `Hello ${input.firstName},\n\nYour registration for ${input.sessionName} is complete.\nClasses: ${input.classNames}\nAmount due: $${input.balanceDue.toFixed(2)}`, variables)
  await sendEmail({ to: input.to, subject: await getEmailSubject('registration_confirmation', 'DVCLC registration confirmation', variables), html: content.html, text: content.text, type: 'registration_confirmation' })
}

export async function sendPaymentConfirmationEmail(input: PaymentNotificationEmailInput) {
  const statement = input.billingStatement || statementHtml({ ...input, paid: true })
  const variables = { firstName: input.firstName, familyName: input.familyName, sessionName: input.sessionName, billingStatement: statement, totalAmount: `$${input.totalAmount.toFixed(2)}`, amountPaid: `$${input.amountPaid.toFixed(2)}`, balanceDue: `$${input.balanceDue.toFixed(2)}` }
  const content = await getEmailContent('payment_confirmation', `<div><p>Hello ${escapeHtml(input.firstName)},</p><p>Your payment has been received.</p>${statement}</div>`, `Hello ${input.firstName},\n\nYour payment has been received.\nTotal: $${input.totalAmount.toFixed(2)}\nPaid: $${input.amountPaid.toFixed(2)}\nBalance: $${input.balanceDue.toFixed(2)}`, variables, ['billingStatement'])
  const pdf = createFeePdf({ title: 'DVCLC Billing Statement', familyName: input.familyName, guardians: await getFamilyGuardians(input.familyId), sessionName: input.sessionName, totalAmount: input.totalAmount, amountPaid: input.amountPaid, balanceDue: input.balanceDue, ...(await getInvoicePdfDetails()) })
  try { await storeUserPdf(input, 'DVCLC-Billing-Statement.pdf', 'billing_statement', pdf) } catch (error) { console.error('Unable to archive billing statement PDF:', error) }
  await sendEmail({ to: input.to, subject: await getEmailSubject('payment_confirmation', 'DVCLC payment confirmation', variables), html: content.html, text: content.text, type: 'payment_confirmation', attachments: [{ filename: 'DVCLC-Billing-Statement.pdf', content: pdf }] })
}

export async function sendPaymentInvoiceEmail(input: PaymentNotificationEmailInput) {
  const invoice = input.invoice || statementHtml({ ...input, paid: false })
  const variables = { firstName: input.firstName, familyName: input.familyName, sessionName: input.sessionName, invoice, totalAmount: `$${input.totalAmount.toFixed(2)}`, amountPaid: `$${input.amountPaid.toFixed(2)}`, balanceDue: `$${input.balanceDue.toFixed(2)}`, dueDate: input.dueDate || '' }
  const content = await getEmailContent('payment_invoice', `<div><p>Hello ${escapeHtml(input.firstName)},</p><p>Your registration invoice is ready.</p>${invoice}</div>`, `Hello ${input.firstName},\n\nYour registration invoice is ready.\nBalance due: $${input.balanceDue.toFixed(2)}`, variables, ['invoice'])
  const pdf = createFeePdf({ title: 'DVCLC Invoice', familyName: input.familyName, guardians: await getFamilyGuardians(input.familyId), sessionName: input.sessionName, totalAmount: input.totalAmount, amountPaid: input.amountPaid, balanceDue: input.balanceDue, dueDate: input.dueDate, ...(await getInvoicePdfDetails()) })
  try { await storeUserPdf(input, 'DVCLC-Invoice.pdf', 'invoice', pdf) } catch (error) { console.error('Unable to archive invoice PDF:', error) }
  await sendEmail({ to: input.to, subject: await getEmailSubject('payment_invoice', 'DVCLC registration invoice', variables), html: content.html, text: content.text, type: 'payment_invoice', attachments: [{ filename: 'DVCLC-Invoice.pdf', content: pdf }] })
}

export async function sendDonationConfirmationEmail(input: DonationConfirmationEmailInput) {
  const variables = { firstName: input.firstName, familyName: input.familyName, donationAmount: `$${input.donationAmount.toFixed(2)}`, billingStatement: input.billingStatement }
  const content = await getEmailContent('donation_confirmation', `<div><p>Hello ${escapeHtml(input.firstName)},</p><p>Thank you for your $${input.donationAmount.toFixed(2)} donation.</p>${input.billingStatement}</div>`, `Hello ${input.firstName},\n\nThank you for your $${input.donationAmount.toFixed(2)} donation.`, variables, ['billingStatement'])
  const pdf = createFeePdf({ title: 'DVCLC Donation Receipt', familyName: input.familyName, guardians: await getFamilyGuardians(input.familyId), sessionName: 'Scholarship Fund', totalAmount: input.donationAmount, amountPaid: input.donationAmount, balanceDue: 0, ...(await getInvoicePdfDetails()), footer: (await getGlobalSetting('invoiceDonationStatement')) || undefined })
  try { if (input.userId && input.familyId) await storeUserPdf({ ...input, sessionName: 'Scholarship Fund', totalAmount: input.donationAmount, amountPaid: input.donationAmount, balanceDue: 0 }, 'DVCLC-Donation-Receipt.pdf', 'donation_receipt', pdf) } catch (error) { console.error('Unable to archive donation receipt PDF:', error) }
  await sendEmail({ to: input.to, subject: await getEmailSubject('donation_confirmation', 'DVCLC donation confirmation', variables), html: content.html, text: content.text, type: 'donation_confirmation', attachments: [{ filename: 'DVCLC-Donation-Receipt.pdf', content: pdf }] })
}

export async function sendIndividualEmail(input: { to: string; cc?: string[]; bcc?: string[]; subject: string; html: string; text: string; senderAlias?: string; replyToAlias?: string }) {
  await sendEmail({ ...input, ...(input.cc?.length ? { cc: input.cc } : {}), ...(input.bcc?.length ? { bcc: input.bcc } : {}), type: 'individual' })
}
