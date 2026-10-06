import { NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { classRegistrations, classTeachingRequests, familyClassCharges, guardians, schedules, sessions, teacherReimbursements } from '@/lib/schema'
import { and, desc, eq, sql } from 'drizzle-orm'

export async function GET() {
  try {
    const auth = await getAuthenticatedAdmin('payments')
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const classes = await db
      .select({
        classTeachingRequestId: classTeachingRequests.id,
        sessionId: sessions.id,
        sessionName: sessions.name,
        className: classTeachingRequests.className,
        teacherName: classTeachingRequests.teacherName,
        feeAmount: sql<number>`COALESCE(${classTeachingRequests.feeAmount}, 0)`,
        guardianId: classTeachingRequests.guardianId,
        teacherFirstName: guardians.firstName,
        teacherLastName: guardians.lastName,
        enrolledCount: sql<number>`COALESCE(COUNT(DISTINCT ${classRegistrations.id}), 0)`,
        totalFees: sql<number>`CASE
          WHEN EXISTS (SELECT 1 FROM ${familyClassCharges} WHERE ${familyClassCharges.classTeachingRequestId} = ${classTeachingRequests.id})
          THEN COALESCE((SELECT SUM(${familyClassCharges.amountCents} - ${familyClassCharges.refundedCents}) / 100.0 FROM ${familyClassCharges} WHERE ${familyClassCharges.classTeachingRequestId} = ${classTeachingRequests.id} AND ${familyClassCharges.billingTreatment} = 'included'), 0)
          ELSE COALESCE(${classTeachingRequests.feeAmount}, 0) * COUNT(DISTINCT ${classRegistrations.id})
        END`,
        refundedFees: sql<number>`COALESCE((SELECT SUM(${familyClassCharges.refundedCents}) / 100.0 FROM ${familyClassCharges} WHERE ${familyClassCharges.classTeachingRequestId} = ${classTeachingRequests.id}), 0)`,
        allocatedReimbursements: sql<number>`COALESCE((SELECT SUM(${teacherReimbursements.amount}) FROM ${teacherReimbursements} WHERE ${teacherReimbursements.classTeachingRequestId} = ${classTeachingRequests.id} AND ${teacherReimbursements.status} IN ('pending', 'paid')), 0)`
      })
      .from(classTeachingRequests)
      .leftJoin(schedules, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
      .innerJoin(sessions, eq(classTeachingRequests.sessionId, sessions.id))
      .leftJoin(guardians, eq(classTeachingRequests.guardianId, guardians.id))
      .leftJoin(
        classRegistrations,
        and(
          eq(classRegistrations.scheduleId, schedules.id),
          eq(classRegistrations.status, 'registered')
        )
      )
      .where(eq(classTeachingRequests.requiresFee, true))
      .groupBy(
        classTeachingRequests.id,
        sessions.id,
        sessions.name,
        classTeachingRequests.className,
        classTeachingRequests.teacherName,
        classTeachingRequests.feeAmount,
        classTeachingRequests.guardianId,
        guardians.firstName,
        guardians.lastName
      )
      .orderBy(desc(sessions.startDate), classTeachingRequests.className)

    return NextResponse.json({ classes })
  } catch (error) {
    console.error('Error fetching class fee summary:', error)
    return NextResponse.json({ error: 'Failed to fetch class fee summary' }, { status: 500 })
  }
}
