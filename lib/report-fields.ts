export const REPORT_FIELDS = [
  { key: 'userName', label: 'User name', type: 'text' }, { key: 'userEmail', label: 'User email', type: 'text' }, { key: 'userRole', label: 'User role', type: 'text' },
  { key: 'sessionName', label: 'Session', type: 'text' }, { key: 'familyName', label: 'Family name', type: 'text' }, { key: 'familyEmail', label: 'Family email', type: 'text' }, { key: 'familyPhone', label: 'Family phone', type: 'text' }, { key: 'familyAddress', label: 'Family address', type: 'text' },
  { key: 'guardianName', label: 'Guardian name', type: 'text' }, { key: 'guardianEmail', label: 'Guardian email', type: 'text' }, { key: 'guardianPhone', label: 'Guardian phone', type: 'text' },
  { key: 'childName', label: 'Child name', type: 'text' }, { key: 'childGrade', label: 'Child grade', type: 'text' }, { key: 'childAllergies', label: 'Child allergies', type: 'text' }, { key: 'childMedicalNotes', label: 'Child medical notes', type: 'text' },
  { key: 'className', label: 'Class', type: 'text' }, { key: 'registrationStatus', label: 'Registration status', type: 'text' }, { key: 'registrationEmergencyContact', label: 'Registration emergency contact', type: 'text' }, { key: 'registrationEmergencyPhone', label: 'Registration emergency phone', type: 'text' },
  { key: 'paymentStatus', label: 'Session payment status', type: 'text' }, { key: 'paidAmount', label: 'Session paid amount', type: 'number' }, { key: 'totalAmount', label: 'Session total amount', type: 'number' }, { key: 'accountPaymentStatus', label: 'Account payment status', type: 'text' }, { key: 'accountPaidAmount', label: 'Account paid amount', type: 'number' }, { key: 'accountTotalAmount', label: 'Account total amount', type: 'number' }, { key: 'accountBalance', label: 'Account balance', type: 'number' },
] as const
export type ReportField = typeof REPORT_FIELDS[number]['key']
export type ReportFilter = { field: ReportField; operator: 'contains' | 'equals' | 'startsWith' | 'isEmpty'; value?: string }
export type ReportScope = 'users' | 'roster'
export type ReportDefinition = { scope: ReportScope; sessionId: string; columns: ReportField[]; filters: ReportFilter[] }

const GLOBAL_FIELDS = new Set<ReportField>(['userName', 'userEmail', 'userRole', 'familyName', 'familyEmail', 'familyPhone', 'familyAddress', 'accountPaymentStatus', 'accountPaidAmount', 'accountTotalAmount', 'accountBalance'])
export function isFieldAvailable(field: ReportField, scope: ReportScope) {
  return scope === 'users' ? GLOBAL_FIELDS.has(field) : !['userName', 'userEmail', 'userRole', 'accountPaymentStatus', 'accountPaidAmount', 'accountTotalAmount', 'accountBalance'].includes(field)
}
