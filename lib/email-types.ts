export const EMAIL_TYPES = [
  'newsletter', 'individual', 'password_reset', 'registration_notification', 'pending_activation', 'account_approved', 'class_request', 'registration_override'
] as const
export type EmailType = typeof EMAIL_TYPES[number]
