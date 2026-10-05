export const REPORT_FIELDS = [
  { key: 'userName', label: 'User name', type: 'text' }, { key: 'userEmail', label: 'User email', type: 'text' }, { key: 'userRole', label: 'User role', type: 'text' },
  { key: 'sessionName', label: 'Session', type: 'text' }, { key: 'familyName', label: 'Family name', type: 'text' }, { key: 'familyEmail', label: 'Family email', type: 'text' }, { key: 'familyPhone', label: 'Family phone', type: 'text' }, { key: 'familyAddress', label: 'Family address', type: 'text' },
  { key: 'guardianName', label: 'Guardian name', type: 'text' }, { key: 'guardianEmail', label: 'Guardian email', type: 'text' }, { key: 'guardianPhone', label: 'Guardian phone', type: 'text' },
  { key: 'childName', label: 'Child name', type: 'text' }, { key: 'childGrade', label: 'Child grade', type: 'text' }, { key: 'childAllergies', label: 'Child allergies', type: 'text' }, { key: 'childMedicalNotes', label: 'Child medical notes', type: 'text' },
  { key: 'className', label: 'Class', type: 'text' }, { key: 'hour', label: 'Hour', type: 'text' }, { key: 'registrationStatus', label: 'Registration status', type: 'text' }, { key: 'registrationEmergencyContact', label: 'Registration emergency contact', type: 'text' }, { key: 'registrationEmergencyPhone', label: 'Registration emergency phone', type: 'text' },
  { key: 'registrationVolunteerJobs', label: 'Volunteer job', type: 'text' }, { key: 'volunteerAssignmentStatus', label: 'Volunteer assignment status', type: 'text' },
  { key: 'paymentStatus', label: 'Session payment status', type: 'text' }, { key: 'paidAmount', label: 'Session paid amount', type: 'number' }, { key: 'totalAmount', label: 'Session total amount', type: 'number' }, { key: 'accountPaymentStatus', label: 'Account payment status', type: 'text' }, { key: 'accountPaidAmount', label: 'Account paid amount', type: 'number' }, { key: 'accountTotalAmount', label: 'Account total amount', type: 'number' }, { key: 'accountBalance', label: 'Account balance', type: 'number' },
] as const
export type ReportField = typeof REPORT_FIELDS[number]['key']
export type ReportFilter = { field: ReportField; operator: 'contains' | 'equals' | 'startsWith' | 'isEmpty'; value?: string }
export type ReportScope = 'users' | 'roster' | 'volunteerJobs'
export type ReportDefinition = { scope: ReportScope; sessionId: string; columns: ReportField[]; filters: ReportFilter[]; distinctRows: boolean }

export const REPORT_FIELD_GROUPS: Record<ReportScope, ReadonlyArray<{ label: string; fields: readonly ReportField[] }>> = {
  users: [
    { label: 'User', fields: ['userName', 'userEmail', 'userRole'] },
    { label: 'Family', fields: ['familyName', 'familyEmail', 'familyPhone', 'familyAddress'] },
    { label: 'Account payment', fields: ['accountPaymentStatus', 'accountPaidAmount', 'accountTotalAmount', 'accountBalance'] },
  ],
  roster: [
    { label: 'Session', fields: ['sessionName'] },
    { label: 'Family', fields: ['familyName', 'familyEmail', 'familyPhone', 'familyAddress'] },
    { label: 'Registering guardian', fields: ['guardianName', 'guardianEmail', 'guardianPhone'] },
    { label: 'Child', fields: ['childName', 'childGrade', 'childAllergies', 'childMedicalNotes'] },
    { label: 'Class', fields: ['className', 'hour'] },
    { label: 'Registration', fields: ['registrationStatus', 'registrationEmergencyContact', 'registrationEmergencyPhone'] },
    { label: 'Session payment', fields: ['paymentStatus', 'paidAmount', 'totalAmount'] },
  ],
  volunteerJobs: [
    { label: 'Session', fields: ['sessionName'] },
    { label: 'Family', fields: ['familyName', 'familyEmail', 'familyPhone', 'familyAddress'] },
    { label: 'Guardian', fields: ['guardianName', 'guardianEmail', 'guardianPhone'] },
    { label: 'Volunteer assignment', fields: ['registrationVolunteerJobs', 'hour', 'volunteerAssignmentStatus'] },
  ],
}

export function isFieldAvailable(field: ReportField, scope: ReportScope) {
  return REPORT_FIELD_GROUPS[scope].some((group) => group.fields.includes(field))
}
