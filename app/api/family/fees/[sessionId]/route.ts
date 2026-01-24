import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { getFamilySessionFeeStatus } from '@/lib/fee-calculation'
import { getGuardianById } from '@/lib/database'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await getAuthenticatedUser()
    const { sessionId } = await params

    // Get guardian info to find family
    const guardian = await getGuardianById(session.user.id)

    if (!guardian) {
      return NextResponse.json({ error: 'User not associated with a family' }, { status: 400 })
    }

    const feeStatus = await getFamilySessionFeeStatus(sessionId, guardian.familyId)

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
