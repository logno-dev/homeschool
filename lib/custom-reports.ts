import 'server-only'
import { and, eq, sum } from 'drizzle-orm'
import { db } from '@/lib/db'
import { classRegistrations, classTeachingRequests, children, families, familySessionFees, guardians, schedules, sessions, users } from '@/lib/schema'
import { isFieldAvailable, REPORT_FIELDS, type ReportDefinition, type ReportField, type ReportFilter } from '@/lib/report-fields'
export { REPORT_FIELDS }
export type { ReportDefinition, ReportField, ReportFilter }

const allowedFields = new Set<string>(REPORT_FIELDS.map((field) => field.key))
const allowedOperators = new Set<ReportFilter['operator']>(['contains', 'equals', 'startsWith', 'isEmpty'])

export function normalizeDefinition(input: unknown): ReportDefinition {
  const value = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const scope = value.scope === 'users' ? 'users' : 'roster'
  const columns = Array.isArray(value.columns) ? value.columns.filter((column): column is ReportField => typeof column === 'string' && allowedFields.has(column) && isFieldAvailable(column as ReportField, scope)) : []
  const filters = Array.isArray(value.filters) ? value.filters.flatMap((filter) => {
    if (!filter || typeof filter !== 'object') return []
    const item = filter as Record<string, unknown>
     if (typeof item.field !== 'string' || !allowedFields.has(item.field) || !isFieldAvailable(item.field as ReportField, scope) || typeof item.operator !== 'string' || !allowedOperators.has(item.operator as ReportFilter['operator'])) return []
    return [{ field: item.field as ReportField, operator: item.operator as ReportFilter['operator'], value: typeof item.value === 'string' ? item.value.slice(0, 200) : '' }]
  }) : []
  return { scope, sessionId: scope === 'users' ? '' : (typeof value.sessionId === 'string' ? value.sessionId : ''), columns: [...new Set(columns)].slice(0, 30), filters: filters.slice(0, 10) }
}

export async function executeReport(definition: ReportDefinition) {
  if (definition.scope === 'users') {
    const accountTotals = await db.select({ familyId: familySessionFees.familyId, paid: sum(familySessionFees.paidAmount), total: sum(familySessionFees.totalFee) }).from(familySessionFees).groupBy(familySessionFees.familyId)
    const totalsByFamily = new Map(accountTotals.map((item) => [item.familyId, { paid: Number(item.paid || 0), total: Number(item.total || 0) }]))
    if (!definition.sessionId) {
      const rows = await db.select({
        userName: users.firstName, userLastName: users.lastName, userEmail: users.email, userRole: users.role, familyId: users.familyId,
        familyName: families.name, familyEmail: families.email, familyPhone: families.phone, familyAddress: families.address,
      }).from(users).leftJoin(families, eq(users.familyId, families.id)).limit(5000)
      return filterRows(rows.map((row) => {
        const totals = totalsByFamily.get(row.familyId || '') || { paid: 0, total: 0 }
        return { ...row, userName: [row.userName, row.userLastName].filter(Boolean).join(' '), accountPaymentStatus: totals.total <= totals.paid ? 'paid' : totals.paid > 0 ? 'partial' : 'pending', accountPaidAmount: totals.paid, accountTotalAmount: totals.total, accountBalance: totals.total - totals.paid }
      }), definition)
    }
    const rows = await db.select({
      userName: users.firstName, userLastName: users.lastName, userEmail: users.email, userRole: users.role,
      familyName: families.name, familyEmail: families.email, familyPhone: families.phone, familyAddress: families.address, annualFeePaid: families.annualFeePaid, annualFeePaymentDate: families.feePaymentDate,
      paymentStatus: familySessionFees.status, paidAmount: familySessionFees.paidAmount, totalAmount: familySessionFees.totalFee,
      sessionName: sessions.name,
    }).from(users)
      .leftJoin(families, eq(users.familyId, families.id))
      .leftJoin(familySessionFees, and(eq(users.familyId, familySessionFees.familyId), eq(familySessionFees.sessionId, definition.sessionId)))
      .leftJoin(sessions, eq(familySessionFees.sessionId, sessions.id))
      .limit(5000)
    return filterRows(rows.map((row) => ({ ...row, userName: [row.userName, row.userLastName].filter(Boolean).join(' ') })), definition)
  }
  const rows = await db.select({
    sessionName: sessions.name, familyName: families.name, familyEmail: families.email, familyPhone: families.phone, familyAddress: families.address,
    guardianName: guardians.firstName, guardianLastName: guardians.lastName, guardianEmail: guardians.email, guardianPhone: guardians.phone,
    childName: children.firstName, childLastName: children.lastName, childGrade: children.grade, childAllergies: children.allergies, childMedicalNotes: children.medicalNotes,
    className: classTeachingRequests.className, registrationStatus: classRegistrations.status, registrationEmergencyContact: classRegistrations.emergencyContact, registrationEmergencyPhone: classRegistrations.emergencyPhone,
  }).from(classRegistrations)
    .innerJoin(sessions, eq(classRegistrations.sessionId, sessions.id))
    .innerJoin(families, eq(classRegistrations.familyId, families.id))
    .innerJoin(children, eq(classRegistrations.childId, children.id))
    .innerJoin(schedules, eq(classRegistrations.scheduleId, schedules.id))
    .innerJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
    .innerJoin(guardians, eq(classRegistrations.registeredBy, guardians.id))
    .leftJoin(users, eq(guardians.id, users.id))
    .where(definition.sessionId ? eq(classRegistrations.sessionId, definition.sessionId) : undefined)
    .limit(5000)

  const mapped = rows.map((row) => ({
    ...row,
    guardianName: [row.guardianName, row.guardianLastName].filter(Boolean).join(' '),
    childName: [row.childName, row.childLastName].filter(Boolean).join(' '),
  })) as Record<string, unknown>[]
  return filterRows(mapped, definition)
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
  return filtered.map((row) => Object.fromEntries(definition.columns.map((column) => [column, row[column] ?? ''])))
}

export function csvValue(value: unknown) {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}
