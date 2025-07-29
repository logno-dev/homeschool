import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { getFamilySessionFeeStatus } from '@/lib/fee-calculation'
import { db } from '@/lib/db'
import { guardians } from '@/lib/schema'
import { eq } from 'drizzle-orm'

export async function GET(
  request: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await getAuthenticatedUser()
    const { sessionId } = params

    // Get guardian info to find family
    const guardian = await db
      .select()
      .from(guardians)
      .where(eq(guardians.id, session.user.id))
      .limit(1)

    if (guardian.length === 0) {
      return NextResponse.json({ error: 'User not associated with a family' }, { status: 400 })
    }

    const feeStatus = await getFamilySessionFeeStatus(sessionId, guardian[0].familyId)

    return NextResponse.json({
      success: true,
      feeStatus
    })

  } catch (error) {
    console.error('Error fetching family fee status:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}