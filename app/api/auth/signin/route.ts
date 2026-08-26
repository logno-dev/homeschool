import { NextRequest, NextResponse } from 'next/server'
import { authenticateWithPassword, createSessionForUser, setSessionCookie } from '@/lib/auth-server'
import { getUserById } from '@/lib/database'
import { hasCurrentAcknowledgement } from '@/lib/acknowledgements'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const account = await authenticateWithPassword(email, password)
    if (!account) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    const user = await getUserById(account.userId)
    if (user?.activationStatus === 'pending') {
      return NextResponse.json({ error: 'Your account is awaiting administrator approval.' }, { status: 403 })
    }

    if (user?.activationStatus === 'parked') {
      const { token, expiresAt } = await createSessionForUser(account.userId)
      const response = NextResponse.json({
        error: 'Your account is parked. Refresh your acknowledgements to request reactivation.',
        accountParked: true,
        requiresAcknowledgement: true
      }, { status: 403 })
      setSessionCookie(response, token, expiresAt)
      return response
    }

    if (!account.isActive) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    const { token, expiresAt } = await createSessionForUser(account.userId)
    const requiresAcknowledgement = !(await hasCurrentAcknowledgement(account.userId))
    const response = NextResponse.json({
      message: 'Signed in successfully',
      mustResetPassword: account.mustResetPassword,
      requiresAcknowledgement
    })

    setSessionCookie(response, token, expiresAt)
    return response
  } catch (error) {
    console.error('Error signing in:', error)
    return NextResponse.json({ error: 'Failed to sign in' }, { status: 500 })
  }
}
