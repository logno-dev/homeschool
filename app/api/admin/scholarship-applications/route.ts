import { NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { scholarshipApplications, families, guardians, sessions, familySessionFees } from '@/lib/schema'
import { desc, eq, sql } from 'drizzle-orm'

export async function GET() {
  try {
    const auth = await getAuthenticatedAdmin('scholarships')
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const applications = await db
      .select({
        id: scholarshipApplications.id,
        applicationId: scholarshipApplications.id,
        familyId: scholarshipApplications.familyId,
        familyName: families.name,
        sessionId: scholarshipApplications.sessionId,
        sessionName: sessions.name,
        guardianFirstName: guardians.firstName,
        guardianLastName: guardians.lastName,
        scholarshipType: scholarshipApplications.scholarshipType,
        requestedAmount: scholarshipApplications.requestedAmount,
        approvedAmount: scholarshipApplications.approvedAmount,
        reason: scholarshipApplications.reason,
        additionalInfo: scholarshipApplications.additionalInfo,
        status: scholarshipApplications.status,
        reviewNotes: scholarshipApplications.reviewNotes,
        createdAt: scholarshipApplications.createdAt,
         remainingAmount: sql<number>`COALESCE(${familySessionFees.totalFee} - ${familySessionFees.paidAmount}, 0)`
        , eligibleAmount: sql<number>`ROUND(COALESCE(${familySessionFees.registrationFee}, 0) * 0.8, 2)`
      })
      .from(scholarshipApplications)
      .leftJoin(families, eq(scholarshipApplications.familyId, families.id))
      .leftJoin(guardians, eq(scholarshipApplications.guardianId, guardians.id))
      .leftJoin(sessions, eq(scholarshipApplications.sessionId, sessions.id))
      .leftJoin(familySessionFees, sql`${familySessionFees.familyId} = ${scholarshipApplications.familyId} AND ${familySessionFees.sessionId} = ${scholarshipApplications.sessionId}`)
      .orderBy(desc(scholarshipApplications.createdAt))

    return NextResponse.json({ applications })
  } catch (error) {
    console.error('Error fetching scholarship applications:', error)
    return NextResponse.json({ error: 'Failed to fetch scholarship applications' }, { status: 500 })
  }
}
