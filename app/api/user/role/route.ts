import { NextResponse } from 'next/server'
import { getAuthenticatedUserSession } from '@/lib/server-auth'
import { getUserById } from '@/lib/database'

export async function GET() {
  try {
    const auth = await getAuthenticatedUserSession()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    
    const { session } = auth

    // Get user role from local database (much faster than external API)
    const user = await getUserById(session.user.id)
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found in system' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      role: user.role,
      isAdmin: user.role === 'admin'
    })
  } catch (error) {
    console.error('Error checking user role:', error)
    return NextResponse.json(
      { error: 'Failed to check user role' },
      { status: 500 }
    )
  }
}