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
