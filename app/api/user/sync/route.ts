import { NextResponse } from 'next/server'
import { getAuthenticatedUserSession, getAppRole } from '@/lib/server-auth'
import { getUserById, createUser, updateUser } from '@/lib/database'

export async function POST() {
  try {
    const auth = await getAuthenticatedUserSession()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    
    const { session } = auth

    // Check if user already exists in local database
    const appRole = await getAppRole(session.user ? (session as { role?: string; roles?: string[]; user?: { id: string } }) : null)
    let user = await getUserById(session.user.id)
    
    if (!user) {
      // Create user in local database with basic info from session
      user = await createUser({
        id: session.user.id,
        email: session.user.email || '',
        firstName: session.user.firstName || '',
        lastName: session.user.lastName || '',
        role: appRole
      })
    } else if (user.role !== appRole) {
      user = await updateUser(user.id, { role: appRole })
    }

    if (!user) {
      return NextResponse.json(
        { error: 'User sync failed' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'User synced successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    })
  } catch (error) {
    console.error('Error syncing user:', error)
    return NextResponse.json(
      { error: 'Failed to sync user' },
      { status: 500 }
    )
  }
}
