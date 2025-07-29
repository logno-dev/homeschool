import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser, fetchFamilyData, checkAdminRole } from '@/lib/server-auth'
import { getClassTeachingRequestsByGuardian, getActiveSession } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser()
    const userId = session.user.id

    // Fetch family data and admin role in parallel
    const [familyData, isAdmin] = await Promise.all([
      fetchFamilyData(userId),
      checkAdminRole(userId)
    ])

    // Check if any guardian in the family has teacher role for the current active session
    let hasTeacherRole = false
    try {
      const activeSession = await getActiveSession()
      if (familyData?.guardians && activeSession) {
        // Check teaching requests for all guardians in the family for the active session
        const teachingRequestPromises = familyData.guardians.map(guardian => 
          getClassTeachingRequestsByGuardian(guardian.id)
        )
        const allTeachingRequests = await Promise.all(teachingRequestPromises)
        
        // If any guardian has teaching requests for the active session, the family has a teacher
        hasTeacherRole = allTeachingRequests.some(requests => 
          requests.some(request => request.sessionId === activeSession.id)
        )
      }
    } catch (error) {
      console.warn('Could not check teaching requests:', error)
    }

    // Find the current user's guardian record
    const currentGuardian = familyData?.guardians?.find(g => g.id === userId)

    const sessionData = {
      userId: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: isAdmin ? (currentGuardian?.role === 'admin' ? 'admin' : 'moderator') : (currentGuardian?.role || 'user'),
      familyId: familyData?.family?.id || null,
      isMainContact: currentGuardian?.isMainContact || false,
      hasTeacherRole,
      familyName: familyData?.family?.name || null,
      annualFeePaid: familyData?.family?.annualFeePaid || false
    }

    return NextResponse.json(sessionData)
  } catch (error) {
    console.error('Error fetching user session data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user session data' },
      { status: 500 }
    )
  }
}