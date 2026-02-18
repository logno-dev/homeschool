import { NextRequest, NextResponse } from 'next/server'
import { resetPasswordFromToken } from '@/lib/auth-server'

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json()

    if (!token || !password) {
      return NextResponse.json({ error: 'Token and password are required' }, { status: 400 })
    }

    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const account = await resetPasswordFromToken(token, password)
    if (!account) {
      return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 400 })
    }

    return NextResponse.json({ message: 'Password updated successfully' })
  } catch (error) {
    console.error('Error resetting password:', error)
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 })
  }
}
