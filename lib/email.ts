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
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL

  if (!apiKey || !from) {
    throw new Error('RESEND_API_KEY and RESEND_FROM_EMAIL must be set')
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text
    })
  })

  if (!response.ok) {
    const payload = await response.text()
    throw new Error(`Resend email failed (${response.status}): ${payload}`)
  }
}

export async function sendNewsletterBatch(input: {
  subject: string
  html: string
  text: string
  recipients: Array<{ email: string; firstName: string; lastName: string }>
}): Promise<string[]> {
  if (input.recipients.length > 100) {
    throw new Error('Newsletter batches cannot exceed 100 recipients')
  }

  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  if (!apiKey || !from) throw new Error('RESEND_API_KEY and RESEND_FROM_EMAIL must be set')

  const response = await fetch('https://api.resend.com/emails/batch', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      emails: input.recipients.map((recipient) => ({
        from,
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

  await sendEmail({
    to: input.to,
    subject: 'Reset your DVCLC password',
    text: `We received a request to reset your DVCLC password.\n\nUse this link to reset your password:\n${input.resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: [
      '<div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">',
      '<h2 style="margin: 0 0 12px;">Reset your DVCLC password</h2>',
      '<p style="margin: 0 0 16px;">We received a request to reset your password.</p>',
      `<p style="margin: 0 0 16px;"><a href="${escapedUrl}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 10px 14px; border-radius: 6px;">Reset password</a></p>`,
      `<p style="margin: 0 0 16px; word-break: break-all;">If the button does not work, use this link:<br/><a href="${escapedUrl}">${escapedUrl}</a></p>`,
      '<p style="margin: 0; color: #6b7280;">If you did not request this, you can ignore this email.</p>',
      '</div>'
    ].join('')
  })
}

export async function sendRegistrationNotificationEmail(input: RegistrationNotificationEmailInput): Promise<void> {
  const name = `${input.firstName} ${input.lastName}`.trim()
  const escapedName = escapeHtml(name)
  const escapedEmail = escapeHtml(input.email)

  await sendEmail({
    to: input.recipients,
    subject: 'New DVCLC account awaiting approval',
    text: `A new DVCLC account is awaiting approval.\n\nName: ${name}\nEmail: ${input.email}`,
    html: `<div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;"><h2>New DVCLC account awaiting approval</h2><p><strong>Name:</strong> ${escapedName}</p><p><strong>Email:</strong> ${escapedEmail}</p><p>Sign in to the admin panel to review and approve this account.</p></div>`
  })
}

export async function sendPendingActivationEmail(input: UserAccountEmailInput): Promise<void> {
  const escapedName = escapeHtml(input.firstName)

  await sendEmail({
    to: input.to,
    subject: 'Your DVCLC account is pending activation',
    text: `Hello ${input.firstName},\n\nThank you for registering for DVCLC. An administrator is reviewing your account and will activate it once the review is complete. You will receive another email when your account is approved.`,
    html: `<div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;"><h2>Your DVCLC account is pending activation</h2><p>Hello ${escapedName},</p><p>Thank you for registering for DVCLC. An administrator is reviewing your account and will activate it once the review is complete.</p><p>You will receive another email when your account is approved.</p></div>`
  })
}

export async function sendAccountApprovedEmail(input: UserAccountEmailInput): Promise<void> {
  const escapedName = escapeHtml(input.firstName)

  await sendEmail({
    to: input.to,
    subject: 'Your DVCLC account has been approved',
    text: `Hello ${input.firstName},\n\nYour DVCLC account has been approved. You can now sign in and complete your family profile.`,
    html: `<div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;"><h2>Your DVCLC account has been approved</h2><p>Hello ${escapedName},</p><p>Your DVCLC account has been approved. You can now sign in and complete your family profile.</p></div>`
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

  await sendEmail({
    to: input.recipients,
    subject: `New class teaching request: ${input.className}`,
    text: `A new class teaching request was submitted.\n\nParent: ${applicantName} (${input.email})\nClass: ${input.className}\nSession: ${input.sessionName}\nGrade range: ${input.gradeRange}\n\nDescription:\n${input.description}`,
    html: `<div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;"><h2>New class teaching request</h2><p><strong>Parent:</strong> ${escapedApplicantName} (${escapedEmail})</p><p><strong>Class:</strong> ${escapedClassName}</p><p><strong>Session:</strong> ${escapedSessionName}</p><p><strong>Grade range:</strong> ${escapedGradeRange}</p><p><strong>Description:</strong><br/>${escapedDescription}</p></div>`
  })
}

export async function sendRegistrationOverrideNotificationEmail(input: RegistrationOverrideNotificationEmailInput): Promise<void> {
  const requester = `${input.firstName} ${input.lastName}`.trim()
  await sendEmail({
    to: input.recipients,
    subject: `Registration override requested: ${requester}`,
    html: `<p><strong>${escapeHtml(requester)}</strong> (${escapeHtml(input.email)}) requested a registration override for <strong>${escapeHtml(input.sessionName)}</strong>.</p><p>Classes: ${escapeHtml(input.classNames || 'Selected classes')}</p><p>Reason: ${escapeHtml(input.reason)}</p>`,
    text: `${requester} (${input.email}) requested a registration override for ${input.sessionName}.\nClasses: ${input.classNames || 'Selected classes'}\nReason: ${input.reason}`
  })
}
