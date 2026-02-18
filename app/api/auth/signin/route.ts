import { NextRequest, NextResponse } from 'next/server'
import { authenticateWithPassword, createSessionForUser, setSessionCookie } from '@/lib/auth-server'

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

    const { token, expiresAt } = await createSessionForUser(account.userId)
    const response = NextResponse.json({
      message: 'Signed in successfully',
      mustResetPassword: account.mustResetPassword
    })

    setSessionCookie(response, token, expiresAt)
    return response
  } catch (error) {
    console.error('Error signing in:', error)
    return NextResponse.json({ error: 'Failed to sign in' }, { status: 500 })
  }
}
