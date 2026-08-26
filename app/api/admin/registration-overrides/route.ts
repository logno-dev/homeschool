import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { familyRegistrationStatus, families, guardians } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin('registration-overrides')
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 })
    }

    // Get all pending admin override requests
    const overrideRequests = await db
      .select({
        id: familyRegistrationStatus.id,
        sessionId: familyRegistrationStatus.sessionId,
        familyId: familyRegistrationStatus.familyId,
        familyName: families.name,
        status: familyRegistrationStatus.status,
        volunteerRequirementsMet: familyRegistrationStatus.volunteerRequirementsMet,
        adminOverride: familyRegistrationStatus.adminOverride,
        adminOverrideReason: familyRegistrationStatus.adminOverrideReason,
        overriddenBy: familyRegistrationStatus.overriddenBy,
        overriddenAt: familyRegistrationStatus.overriddenAt,
        createdAt: familyRegistrationStatus.createdAt,
        updatedAt: familyRegistrationStatus.updatedAt
      })
      .from(familyRegistrationStatus)
      .leftJoin(families, eq(familyRegistrationStatus.familyId, families.id))
      .where(
        and(
          eq(familyRegistrationStatus.sessionId, sessionId),
          eq(familyRegistrationStatus.status, 'admin_override'),
          eq(familyRegistrationStatus.adminOverride, true)
        )
      )
      .orderBy(familyRegistrationStatus.createdAt)

    return NextResponse.json({ overrideRequests })
  } catch (error) {
    console.error('Error fetching override requests:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
