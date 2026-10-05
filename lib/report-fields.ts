export const REPORT_FIELDS = [
  { key: 'userName', label: 'Name', type: 'text' }, { key: 'userEmail', label: 'Email', type: 'text' }, { key: 'userRole', label: 'Role', type: 'text' },
  { key: 'sessionName', label: 'Name', type: 'text' }, { key: 'sessionStartDate', label: 'Start date', type: 'text' }, { key: 'sessionEndDate', label: 'End date', type: 'text' },
  { key: 'familyName', label: 'Name', type: 'text' }, { key: 'familyEmail', label: 'Email', type: 'text' }, { key: 'familyPhone', label: 'Phone', type: 'text' }, { key: 'familyAddress', label: 'Address', type: 'text' }, { key: 'familyAnnualFeePaid', label: 'Annual fee paid', type: 'text' },
  { key: 'guardianName', label: 'Name', type: 'text' }, { key: 'guardianEmail', label: 'Email', type: 'text' }, { key: 'guardianPhone', label: 'Phone', type: 'text' }, { key: 'guardianRole', label: 'Role', type: 'text' }, { key: 'guardianIsMainContact', label: 'Main contact', type: 'text' },
  { key: 'childName', label: 'Name', type: 'text' }, { key: 'childDateOfBirth', label: 'Date of birth', type: 'text' }, { key: 'childGrade', label: 'Grade', type: 'text' }, { key: 'childAllergies', label: 'Allergies', type: 'text' }, { key: 'childMedicalNotes', label: 'Medical notes', type: 'text' },
  { key: 'className', label: 'Name', type: 'text' }, { key: 'classDescription', label: 'Description', type: 'text' }, { key: 'classGradeRange', label: 'Grade range', type: 'text' }, { key: 'classMaxStudents', label: 'Maximum students', type: 'number' }, { key: 'classRegistrationCount', label: 'Registered students', type: 'number' }, { key: 'classroomName', label: 'Classroom', type: 'text' }, { key: 'hour', label: 'Hour', type: 'text' }, { key: 'scheduleStatus', label: 'Schedule status', type: 'text' }, { key: 'classRequiresFee', label: 'Requires fee', type: 'text' }, { key: 'classFeeAmount', label: 'Fee amount', type: 'number' },
  { key: 'teacherName', label: 'Teacher name', type: 'text' }, { key: 'teacherEmail', label: 'Teacher email', type: 'text' }, { key: 'teacherPhone', label: 'Teacher phone', type: 'text' }, { key: 'coTeacherName', label: 'Co-teacher name', type: 'text' }, { key: 'coTeacherEmail', label: 'Co-teacher email', type: 'text' }, { key: 'coTeacherPhone', label: 'Co-teacher phone', type: 'text' }, { key: 'studentTeacherName', label: 'Student teacher', type: 'text' }, { key: 'studentCoTeacherName', label: 'Student co-teacher', type: 'text' },
  { key: 'classHelpers', label: 'Helper names', type: 'text' }, { key: 'classHelperCount', label: 'Assigned helpers', type: 'number' }, { key: 'classHelpersNeeded', label: 'Helpers needed', type: 'number' },
  { key: 'registrationStatus', label: 'Status', type: 'text' }, { key: 'registrationRegisteredAt', label: 'Registered at', type: 'text' }, { key: 'registrationEmergencyContact', label: 'Emergency contact', type: 'text' }, { key: 'registrationEmergencyPhone', label: 'Emergency phone', type: 'text' },
  { key: 'volunteerType', label: 'Role', type: 'text' }, { key: 'registrationVolunteerJobs', label: 'Volunteer job', type: 'text' }, { key: 'volunteerJobDescription', label: 'Job description', type: 'text' }, { key: 'volunteerJobType', label: 'Job type', type: 'text' }, { key: 'volunteerAssignmentStatus', label: 'Status', type: 'text' }, { key: 'volunteerAssignedAt', label: 'Assigned at', type: 'text' },
  { key: 'paymentStatus', label: 'Status', type: 'text' }, { key: 'registrationFee', label: 'Registration fee', type: 'number' }, { key: 'classFees', label: 'Class fees', type: 'number' }, { key: 'paidAmount', label: 'Paid amount', type: 'number' }, { key: 'totalAmount', label: 'Total amount', type: 'number' }, { key: 'paymentBalance', label: 'Balance', type: 'number' }, { key: 'paymentDueDate', label: 'Due date', type: 'text' },
  { key: 'accountPaymentStatus', label: 'Payment status', type: 'text' }, { key: 'accountPaidAmount', label: 'Paid amount', type: 'number' }, { key: 'accountTotalAmount', label: 'Total amount', type: 'number' }, { key: 'accountBalance', label: 'Balance', type: 'number' },
] as const
export type ReportField = typeof REPORT_FIELDS[number]['key']
export type ReportFilter = { field: ReportField; operator: 'contains' | 'equals' | 'startsWith' | 'isEmpty'; value?: string }
export type ReportScope = 'users' | 'roster' | 'classes' | 'volunteerJobs'
export type ReportDefinition = { scope: ReportScope; sessionId: string; columns: ReportField[]; filters: ReportFilter[]; distinctRows: boolean }

export const REPORT_FIELD_GROUPS: Record<ReportScope, ReadonlyArray<{ label: string; fields: readonly ReportField[] }>> = {
  users: [
    { label: 'User', fields: ['userName', 'userEmail', 'userRole'] },
    { label: 'Family', fields: ['familyName', 'familyEmail', 'familyPhone', 'familyAddress', 'familyAnnualFeePaid'] },
    { label: 'Account payment', fields: ['accountPaymentStatus', 'accountPaidAmount', 'accountTotalAmount', 'accountBalance'] },
  ],
  roster: [
    { label: 'Session', fields: ['sessionName', 'sessionStartDate', 'sessionEndDate'] },
    { label: 'Family', fields: ['familyName', 'familyEmail', 'familyPhone', 'familyAddress', 'familyAnnualFeePaid'] },
    { label: 'Registering guardian', fields: ['guardianName', 'guardianEmail', 'guardianPhone', 'guardianRole', 'guardianIsMainContact'] },
    { label: 'Child', fields: ['childName', 'childDateOfBirth', 'childGrade', 'childAllergies', 'childMedicalNotes'] },
    { label: 'Class', fields: ['className', 'classDescription', 'classGradeRange', 'classMaxStudents', 'classroomName', 'hour', 'classRequiresFee', 'classFeeAmount'] },
    { label: 'Teachers', fields: ['teacherName', 'teacherEmail', 'teacherPhone', 'coTeacherName', 'coTeacherEmail', 'coTeacherPhone', 'studentTeacherName', 'studentCoTeacherName'] },
    { label: 'Helpers', fields: ['classHelpers', 'classHelperCount', 'classHelpersNeeded'] },
    { label: 'Registration', fields: ['registrationStatus', 'registrationRegisteredAt', 'registrationEmergencyContact', 'registrationEmergencyPhone'] },
    { label: 'Session payment', fields: ['paymentStatus', 'registrationFee', 'classFees', 'paidAmount', 'totalAmount', 'paymentBalance', 'paymentDueDate'] },
  ],
  classes: [
    { label: 'Session', fields: ['sessionName', 'sessionStartDate', 'sessionEndDate'] },
    { label: 'Class', fields: ['className', 'classDescription', 'classGradeRange', 'classMaxStudents', 'classRegistrationCount', 'classroomName', 'hour', 'scheduleStatus', 'classRequiresFee', 'classFeeAmount'] },
    { label: 'Teachers', fields: ['teacherName', 'teacherEmail', 'teacherPhone', 'coTeacherName', 'coTeacherEmail', 'coTeacherPhone', 'studentTeacherName', 'studentCoTeacherName'] },
    { label: 'Helpers', fields: ['classHelpers', 'classHelperCount', 'classHelpersNeeded'] },
  ],
  volunteerJobs: [
    { label: 'Session', fields: ['sessionName', 'sessionStartDate', 'sessionEndDate'] },
    { label: 'Family', fields: ['familyName', 'familyEmail', 'familyPhone', 'familyAddress', 'familyAnnualFeePaid'] },
    { label: 'Guardian', fields: ['guardianName', 'guardianEmail', 'guardianPhone', 'guardianRole', 'guardianIsMainContact'] },
    { label: 'Assignment', fields: ['volunteerType', 'hour', 'volunteerAssignmentStatus', 'volunteerAssignedAt'] },
    { label: 'Class assignment', fields: ['className', 'classroomName', 'teacherName'] },
    { label: 'Volunteer job', fields: ['registrationVolunteerJobs', 'volunteerJobDescription', 'volunteerJobType'] },
  ],
}

export function isFieldAvailable(field: ReportField, scope: ReportScope) {
  return REPORT_FIELD_GROUPS[scope].some((group) => group.fields.includes(field))
}

export function getReportColumnLabel(field: ReportField, scope: ReportScope) {
  const group = REPORT_FIELD_GROUPS[scope].find((item) => item.fields.includes(field))
  const label = REPORT_FIELDS.find((item) => item.key === field)?.label || field
  return group ? `${group.label}: ${label}` : label
}
