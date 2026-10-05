import 'server-only'
import { and, eq, inArray, sum } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { db } from '@/lib/db'
import { classRegistrations, classTeachingRequests, children, families, familySessionFees, guardians, schedules, sessionClassrooms, sessions, users, volunteerAssignments, volunteerJobs } from '@/lib/schema'
import { isFieldAvailable, REPORT_FIELDS, type ReportDefinition, type ReportField, type ReportFilter } from '@/lib/report-fields'
export { REPORT_FIELDS }
export type { ReportDefinition, ReportField, ReportFilter }

const allowedFields = new Set<string>(REPORT_FIELDS.map((field) => field.key))
const allowedOperators = new Set<ReportFilter['operator']>(['contains', 'equals', 'startsWith', 'isEmpty'])
const teacherGuardians = alias(guardians, 'report_teacher_guardians')
const coTeacherGuardians = alias(guardians, 'report_co_teacher_guardians')
const studentTeacherChildren = alias(children, 'report_student_teacher_children')
const studentCoTeacherChildren = alias(children, 'report_student_co_teacher_children')

export function normalizeDefinition(input: unknown): ReportDefinition {
  const value = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const scope = value.scope === 'users' || value.scope === 'classes' || value.scope === 'volunteerJobs' ? value.scope : 'roster'
  const columns = Array.isArray(value.columns) ? value.columns.filter((column): column is ReportField => typeof column === 'string' && allowedFields.has(column) && isFieldAvailable(column as ReportField, scope)) : []
  const filters = Array.isArray(value.filters) ? value.filters.flatMap((filter) => {
    if (!filter || typeof filter !== 'object') return []
    const item = filter as Record<string, unknown>
     if (typeof item.field !== 'string' || !allowedFields.has(item.field) || !isFieldAvailable(item.field as ReportField, scope) || typeof item.operator !== 'string' || !allowedOperators.has(item.operator as ReportFilter['operator'])) return []
    return [{ field: item.field as ReportField, operator: item.operator as ReportFilter['operator'], value: typeof item.value === 'string' ? item.value.slice(0, 200) : '' }]
  }) : []
  return { scope, sessionId: scope === 'users' ? '' : (typeof value.sessionId === 'string' ? value.sessionId : ''), columns: [...new Set(columns)].slice(0, 30), filters: filters.slice(0, 10), distinctRows: value.distinctRows === true }
}

export async function executeReport(definition: ReportDefinition) {
  if (definition.scope === 'users') {
    const accountTotals = await db.select({ familyId: familySessionFees.familyId, paid: sum(familySessionFees.paidAmount), total: sum(familySessionFees.totalFee) }).from(familySessionFees).groupBy(familySessionFees.familyId)
    const totalsByFamily = new Map(accountTotals.map((item) => [item.familyId, { paid: Number(item.paid || 0), total: Number(item.total || 0) }]))
    if (!definition.sessionId) {
      const rows = await db.select({
        userName: users.firstName, userLastName: users.lastName, userEmail: users.email, userRole: users.role, familyId: users.familyId,
        familyName: families.name, familyEmail: families.email, familyPhone: families.phone, familyAddress: families.address, familyAnnualFeePaid: families.annualFeePaid,
      }).from(users).leftJoin(families, eq(users.familyId, families.id)).limit(5000)
      return filterRows(rows.map((row) => {
        const totals = totalsByFamily.get(row.familyId || '') || { paid: 0, total: 0 }
        return { ...row, userName: [row.userName, row.userLastName].filter(Boolean).join(' '), accountPaymentStatus: totals.total <= totals.paid ? 'paid' : totals.paid > 0 ? 'partial' : 'pending', accountPaidAmount: totals.paid, accountTotalAmount: totals.total, accountBalance: totals.total - totals.paid }
      }), definition)
    }
    const rows = await db.select({
      userName: users.firstName, userLastName: users.lastName, userEmail: users.email, userRole: users.role,
      familyName: families.name, familyEmail: families.email, familyPhone: families.phone, familyAddress: families.address, familyAnnualFeePaid: families.annualFeePaid,
      paymentStatus: familySessionFees.status, paidAmount: familySessionFees.paidAmount, totalAmount: familySessionFees.totalFee,
      sessionName: sessions.name,
    }).from(users)
      .leftJoin(families, eq(users.familyId, families.id))
      .leftJoin(familySessionFees, and(eq(users.familyId, familySessionFees.familyId), eq(familySessionFees.sessionId, definition.sessionId)))
      .leftJoin(sessions, eq(familySessionFees.sessionId, sessions.id))
      .limit(5000)
    return filterRows(rows.map((row) => ({ ...row, userName: [row.userName, row.userLastName].filter(Boolean).join(' ') })), definition)
  }
  if (definition.scope === 'volunteerJobs') {
    const rows = await db.select({
      sessionName: sessions.name, sessionStartDate: sessions.startDate, sessionEndDate: sessions.endDate,
      familyName: families.name, familyEmail: families.email, familyPhone: families.phone, familyAddress: families.address, familyAnnualFeePaid: families.annualFeePaid,
      guardianName: guardians.firstName, guardianLastName: guardians.lastName, guardianEmail: guardians.email, guardianPhone: guardians.phone, guardianRole: guardians.role, guardianIsMainContact: guardians.isMainContact,
      volunteerType: volunteerAssignments.volunteerType, hour: volunteerAssignments.period, volunteerAssignmentStatus: volunteerAssignments.status, volunteerAssignedAt: volunteerAssignments.assignedAt,
      className: classTeachingRequests.className, classroomName: sessionClassrooms.name, classTeacherName: classTeachingRequests.teacherName, teacherFirstName: teacherGuardians.firstName, teacherLastName: teacherGuardians.lastName,
      registrationVolunteerJobs: volunteerJobs.title, volunteerJobDescription: volunteerJobs.description, volunteerJobType: volunteerJobs.jobType,
    })
      .from(volunteerAssignments)
      .innerJoin(sessions, eq(volunteerAssignments.sessionId, sessions.id))
      .innerJoin(families, eq(volunteerAssignments.familyId, families.id))
      .innerJoin(guardians, eq(volunteerAssignments.guardianId, guardians.id))
      .leftJoin(schedules, eq(volunteerAssignments.scheduleId, schedules.id))
      .leftJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
      .leftJoin(sessionClassrooms, eq(schedules.sessionClassroomId, sessionClassrooms.id))
      .leftJoin(teacherGuardians, eq(classTeachingRequests.guardianId, teacherGuardians.id))
      .leftJoin(volunteerJobs, eq(volunteerAssignments.volunteerJobId, volunteerJobs.id))
      .where(and(
        definition.sessionId ? eq(volunteerAssignments.sessionId, definition.sessionId) : undefined,
        inArray(volunteerAssignments.status, ['assigned', 'pending', 'completed'])
      ))
      .limit(5000)
    return filterRows(rows.map((row) => ({
      ...row,
      guardianName: [row.guardianName, row.guardianLastName].filter(Boolean).join(' '),
      hour: reportHour(row.hour),
      volunteerType: reportLabel(row.volunteerType),
      volunteerJobType: reportLabel(row.volunteerJobType),
      teacherName: row.classTeacherName || [row.teacherFirstName, row.teacherLastName].filter(Boolean).join(' '),
    })), definition)
  }

  if (definition.scope === 'classes') {
    const [rows, metrics] = await Promise.all([
      db.select({
        scheduleId: schedules.id,
        sessionName: sessions.name, sessionStartDate: sessions.startDate, sessionEndDate: sessions.endDate,
        className: classTeachingRequests.className, classDescription: classTeachingRequests.description, classGradeRange: classTeachingRequests.gradeRange, classMaxStudents: classTeachingRequests.maxStudents,
        classroomName: sessionClassrooms.name, hour: schedules.period, scheduleStatus: schedules.status, classRequiresFee: classTeachingRequests.requiresFee, classFeeAmount: classTeachingRequests.feeAmount, classHelpersNeeded: classTeachingRequests.helpersNeeded,
        classTeacherName: classTeachingRequests.teacherName, teacherFirstName: teacherGuardians.firstName, teacherLastName: teacherGuardians.lastName, teacherEmail: teacherGuardians.email, teacherPhone: teacherGuardians.phone,
        classCoTeacherName: classTeachingRequests.coTeacher, coTeacherFirstName: coTeacherGuardians.firstName, coTeacherLastName: coTeacherGuardians.lastName, coTeacherEmail: coTeacherGuardians.email, coTeacherPhone: coTeacherGuardians.phone,
        studentTeacherFirstName: studentTeacherChildren.firstName, studentTeacherLastName: studentTeacherChildren.lastName,
        studentCoTeacherFirstName: studentCoTeacherChildren.firstName, studentCoTeacherLastName: studentCoTeacherChildren.lastName,
      }).from(schedules)
        .innerJoin(sessions, eq(schedules.sessionId, sessions.id))
        .innerJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
        .leftJoin(sessionClassrooms, eq(schedules.sessionClassroomId, sessionClassrooms.id))
        .leftJoin(teacherGuardians, eq(classTeachingRequests.guardianId, teacherGuardians.id))
        .leftJoin(coTeacherGuardians, eq(classTeachingRequests.coTeacherId, coTeacherGuardians.id))
        .leftJoin(studentTeacherChildren, eq(classTeachingRequests.studentTeacherChildId, studentTeacherChildren.id))
        .leftJoin(studentCoTeacherChildren, eq(classTeachingRequests.studentCoTeacherChildId, studentCoTeacherChildren.id))
        .where(definition.sessionId ? eq(schedules.sessionId, definition.sessionId) : undefined)
        .limit(5000),
      getScheduleMetrics(definition.sessionId),
    ])
    return filterRows(rows.map((row) => ({
      ...row,
      hour: reportHour(row.hour),
      teacherName: row.classTeacherName || fullName(row.teacherFirstName, row.teacherLastName),
      coTeacherName: row.classCoTeacherName || fullName(row.coTeacherFirstName, row.coTeacherLastName),
      studentTeacherName: fullName(row.studentTeacherFirstName, row.studentTeacherLastName),
      studentCoTeacherName: fullName(row.studentCoTeacherFirstName, row.studentCoTeacherLastName),
      classHelpers: (metrics.helpers.get(row.scheduleId) || []).join(', '),
      classHelperCount: metrics.helpers.get(row.scheduleId)?.length || 0,
      classRegistrationCount: metrics.registrationCounts.get(row.scheduleId) || 0,
    })), definition)
  }

  const [rows, metrics, feeRows] = await Promise.all([
    db.select({
      scheduleId: schedules.id, familyId: families.id,
      sessionName: sessions.name, sessionStartDate: sessions.startDate, sessionEndDate: sessions.endDate,
      familyName: families.name, familyEmail: families.email, familyPhone: families.phone, familyAddress: families.address, familyAnnualFeePaid: families.annualFeePaid,
      guardianName: guardians.firstName, guardianLastName: guardians.lastName, guardianEmail: guardians.email, guardianPhone: guardians.phone, guardianRole: guardians.role, guardianIsMainContact: guardians.isMainContact,
      childName: children.firstName, childLastName: children.lastName, childDateOfBirth: children.dateOfBirth, childGrade: children.grade, childAllergies: children.allergies, childMedicalNotes: children.medicalNotes,
      className: classTeachingRequests.className, classDescription: classTeachingRequests.description, classGradeRange: classTeachingRequests.gradeRange, classMaxStudents: classTeachingRequests.maxStudents,
      classroomName: sessionClassrooms.name, hour: schedules.period, classRequiresFee: classTeachingRequests.requiresFee, classFeeAmount: classTeachingRequests.feeAmount, classHelpersNeeded: classTeachingRequests.helpersNeeded,
      classTeacherName: classTeachingRequests.teacherName, teacherFirstName: teacherGuardians.firstName, teacherLastName: teacherGuardians.lastName, teacherEmail: teacherGuardians.email, teacherPhone: teacherGuardians.phone,
      classCoTeacherName: classTeachingRequests.coTeacher, coTeacherFirstName: coTeacherGuardians.firstName, coTeacherLastName: coTeacherGuardians.lastName, coTeacherEmail: coTeacherGuardians.email, coTeacherPhone: coTeacherGuardians.phone,
      studentTeacherFirstName: studentTeacherChildren.firstName, studentTeacherLastName: studentTeacherChildren.lastName,
      studentCoTeacherFirstName: studentCoTeacherChildren.firstName, studentCoTeacherLastName: studentCoTeacherChildren.lastName,
      registrationStatus: classRegistrations.status, registrationRegisteredAt: classRegistrations.registeredAt, registrationEmergencyContact: classRegistrations.emergencyContact, registrationEmergencyPhone: classRegistrations.emergencyPhone,
    }).from(classRegistrations)
      .innerJoin(sessions, eq(classRegistrations.sessionId, sessions.id))
      .innerJoin(families, eq(classRegistrations.familyId, families.id))
      .innerJoin(children, eq(classRegistrations.childId, children.id))
      .innerJoin(schedules, eq(classRegistrations.scheduleId, schedules.id))
      .innerJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
      .innerJoin(guardians, eq(classRegistrations.registeredBy, guardians.id))
      .leftJoin(sessionClassrooms, eq(schedules.sessionClassroomId, sessionClassrooms.id))
      .leftJoin(teacherGuardians, eq(classTeachingRequests.guardianId, teacherGuardians.id))
      .leftJoin(coTeacherGuardians, eq(classTeachingRequests.coTeacherId, coTeacherGuardians.id))
      .leftJoin(studentTeacherChildren, eq(classTeachingRequests.studentTeacherChildId, studentTeacherChildren.id))
      .leftJoin(studentCoTeacherChildren, eq(classTeachingRequests.studentCoTeacherChildId, studentCoTeacherChildren.id))
      .where(definition.sessionId ? eq(classRegistrations.sessionId, definition.sessionId) : undefined)
      .limit(5000),
    getScheduleMetrics(definition.sessionId),
    db.select().from(familySessionFees).where(definition.sessionId ? eq(familySessionFees.sessionId, definition.sessionId) : undefined),
  ])

  const feesByFamily = new Map<string, typeof feeRows[number]>()
  for (const fee of feeRows) {
    const current = feesByFamily.get(fee.familyId)
    if (!current || fee.updatedAt > current.updatedAt) feesByFamily.set(fee.familyId, fee)
  }

  const mapped = rows.map((row) => ({
    ...row,
    guardianName: fullName(row.guardianName, row.guardianLastName),
    childName: fullName(row.childName, row.childLastName),
    hour: reportHour(row.hour),
    teacherName: row.classTeacherName || fullName(row.teacherFirstName, row.teacherLastName),
    coTeacherName: row.classCoTeacherName || fullName(row.coTeacherFirstName, row.coTeacherLastName),
    studentTeacherName: fullName(row.studentTeacherFirstName, row.studentTeacherLastName),
    studentCoTeacherName: fullName(row.studentCoTeacherFirstName, row.studentCoTeacherLastName),
    classHelpers: (metrics.helpers.get(row.scheduleId) || []).join(', '),
    classHelperCount: metrics.helpers.get(row.scheduleId)?.length || 0,
    ...paymentFields(feesByFamily.get(row.familyId)),
  })) as Record<string, unknown>[]
  return filterRows(mapped, definition)
}

function reportHour(period: string) {
  return ({ '1': 'First Hour', first: 'First Hour', '2': 'Second Hour', second: 'Second Hour', lunch: 'Lunch', '3': 'Third Hour', third: 'Third Hour', non_period: 'General' } as Record<string, string>)[period] || period
}

function reportLabel(value: string | null) {
  return value ? value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : ''
}

function fullName(firstName: string | null, lastName: string | null) {
  return [firstName, lastName].filter(Boolean).join(' ')
}

function paymentFields(fee: typeof familySessionFees.$inferSelect | undefined) {
  return {
    paymentStatus: fee?.status || '', registrationFee: fee?.registrationFee ?? '', classFees: fee?.classFees ?? '', paidAmount: fee?.paidAmount ?? '', totalAmount: fee?.totalFee ?? '',
    paymentBalance: fee ? Math.max(0, fee.totalFee - fee.paidAmount) : '', paymentDueDate: fee?.dueDate || '',
  }
}

async function getScheduleMetrics(sessionId: string) {
  const [helperRows, registrationRows] = await Promise.all([
    db.select({ scheduleId: volunteerAssignments.scheduleId, firstName: guardians.firstName, lastName: guardians.lastName })
      .from(volunteerAssignments)
      .innerJoin(guardians, eq(volunteerAssignments.guardianId, guardians.id))
      .where(and(
        sessionId ? eq(volunteerAssignments.sessionId, sessionId) : undefined,
        eq(volunteerAssignments.volunteerType, 'helper'),
        inArray(volunteerAssignments.status, ['assigned', 'pending', 'completed'])
      )),
    db.select({ scheduleId: classRegistrations.scheduleId })
      .from(classRegistrations)
      .where(and(
        sessionId ? eq(classRegistrations.sessionId, sessionId) : undefined,
        eq(classRegistrations.status, 'registered')
      )),
  ])
  const helpers = new Map<string, string[]>()
  for (const helper of helperRows) {
    if (!helper.scheduleId) continue
    const names = helpers.get(helper.scheduleId) || []
    names.push(fullName(helper.firstName, helper.lastName))
    helpers.set(helper.scheduleId, names)
  }
  for (const names of helpers.values()) names.sort()
  const registrationCounts = new Map<string, number>()
  for (const registration of registrationRows) registrationCounts.set(registration.scheduleId, (registrationCounts.get(registration.scheduleId) || 0) + 1)
  return { helpers, registrationCounts }
}

function filterRows(rows: Record<string, unknown>[], definition: ReportDefinition) {
  const filtered = rows.filter((row) => definition.filters.every((filter) => {
    const value = String(row[filter.field] ?? '').toLowerCase()
    const target = String(filter.value ?? '').toLowerCase()
    if (filter.operator === 'isEmpty') return value.length === 0
    if (filter.operator === 'equals') return value === target
    if (filter.operator === 'startsWith') return value.startsWith(target)
    return value.includes(target)
  }))
  const projected = filtered.map((row) => Object.fromEntries(definition.columns.map((column) => [column, row[column] ?? ''])))
  if (!definition.distinctRows) return projected
  const seen = new Set<string>()
  return projected.filter((row) => {
    const key = JSON.stringify(row)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function csvValue(value: unknown) {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}
