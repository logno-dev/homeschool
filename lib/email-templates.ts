import type { EmailType } from './email-types'

export const NOTIFICATION_TYPES = [
  'registration_notification',
  'class_request',
  'registration_override',
  'password_reset',
  'pending_activation',
  'account_approved',
  'registration_confirmation',
  'payment_confirmation',
  'payment_invoice',
  'donation_confirmation'
] as const satisfies readonly EmailType[]

export type NotificationType = typeof NOTIFICATION_TYPES[number]

export const EMAIL_TEMPLATE_VARIABLES: Record<NotificationType, string[]> = {
  password_reset: ['resetUrl'],
  registration_notification: ['name', 'email'],
  pending_activation: ['firstName'],
  account_approved: ['firstName'],
  class_request: ['applicantName', 'email', 'className', 'description', 'gradeRange', 'sessionName'],
  registration_override: ['requesterName', 'email', 'sessionName', 'classNames', 'reason'],
  registration_confirmation: ['firstName', 'sessionName', 'classNames', 'totalAmount', 'amountPaid', 'balanceDue'],
  payment_confirmation: ['firstName', 'familyName', 'sessionName', 'billingStatement', 'totalAmount', 'amountPaid', 'balanceDue'],
  payment_invoice: ['firstName', 'familyName', 'sessionName', 'invoice', 'totalAmount', 'amountPaid', 'balanceDue', 'dueDate'],
  donation_confirmation: ['firstName', 'familyName', 'donationAmount', 'billingStatement']
}
