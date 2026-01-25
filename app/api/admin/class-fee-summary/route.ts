import { NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { classRegistrations, classTeachingRequests, guardians, schedules, sessions } from '@/lib/schema'
import { and, desc, eq, sql } from 'drizzle-orm'

export async function GET() {
  try {
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const classes = await db
      .select({
        classTeachingRequestId: classTeachingRequests.id,
        sessionId: sessions.id,
        sessionName: sessions.name,
        className: classTeachingRequests.className,
        feeAmount: sql<number>`COALESCE(${classTeachingRequests.feeAmount}, 0)`,
        guardianId: classTeachingRequests.guardianId,
        teacherFirstName: guardians.firstName,
        teacherLastName: guardians.lastName,
        enrolledCount: sql<number>`COALESCE(COUNT(${classRegistrations.id}), 0)`,
        totalFees: sql<number>`COALESCE(COUNT(${classRegistrations.id}), 0) * COALESCE(${classTeachingRequests.feeAmount}, 0)`
      })
      .from(classTeachingRequests)
      .innerJoin(schedules, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
      .innerJoin(sessions, eq(classTeachingRequests.sessionId, sessions.id))
      .innerJoin(guardians, eq(classTeachingRequests.guardianId, guardians.id))
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
