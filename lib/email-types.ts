export const EMAIL_TYPES = [
  'newsletter', 'individual', 'password_reset', 'registration_notification', 'pending_activation', 'account_approved', 'class_request', 'registration_override', 'registration_confirmation', 'payment_confirmation', 'payment_invoice', 'donation_confirmation'
] as const
export type EmailType = typeof EMAIL_TYPES[number]
