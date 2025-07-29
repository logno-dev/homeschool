import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { checkUserFamilyTeacherStatus } from '@/lib/early-registration'

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser()
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    // Check if any parent in the family is registered to teach for this session
    const hasTeacherInFamily = await checkUserFamilyTeacherStatus(session.user.id, sessionId)

    return NextResponse.json({
      hasEarlyAccess: hasTeacherInFamily,
      reason: hasTeacherInFamily 
        ? 'Family has a teacher registered for this session'
        : 'No teachers in family for this session'
    })

  } catch (error) {
    console.error('Error checking early registration access:', error)
    return NextResponse.json(
      { error: 'Failed to check early registration access' },
      { status: 500 }
    )
  }
}