import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { familyRegistrationStatus, families, guardians } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || !session.accessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Check if user is admin using external auth API
    const roleResponse = await fetch(`${process.env.AUTH_API_URL}/api/user/${session.user.id}/role`, {
      method: 'GET',
      headers: {
        'x-api-key': process.env.AUTH_API_KEY!,
        'Authorization': `Bearer ${session.accessToken}`,
      },
    })

    if (!roleResponse.ok) {
      return NextResponse.json({ error: 'Failed to verify admin role' }, { status: 403 })
    }

    const roleData = await roleResponse.json()
    if (roleData.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
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