import { NextResponse } from 'next/server'
import { getAuthenticatedUserSession } from '@/lib/server-auth'

import { getOpenClassTeachingSessions, isClassTeachingRegistrationOpen } from '@/lib/database'

export async function GET() {
  try {
    const auth = await getAuthenticatedUserSession()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    
    const { session } = auth
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const [registrationStatus, openSessions] = await Promise.all([
      isClassTeachingRegistrationOpen(session.user.id),
      getOpenClassTeachingSessions(session.user.id)
    ])
    
    return NextResponse.json({ ...registrationStatus, openSessions })
  } catch (error) {
    console.error('Error checking class teaching registration status:', error)
    return NextResponse.json(
      { error: 'Failed to check registration status' },
      { status: 500 }
    )
  }
}
