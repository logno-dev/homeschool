import { NextRequest, NextResponse } from 'next/server'
import { createPasswordResetToken } from '@/lib/auth-server'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const token = await createPasswordResetToken(email)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const resetUrl = token && process.env.NODE_ENV !== 'production'
      ? `${appUrl}/reset-password?token=${token}`
      : null

    return NextResponse.json({
      message: 'If an account exists for that email, a reset link has been generated.',
      resetUrl
    })
  } catch (error) {
    console.error('Error creating password reset token:', error)
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 })
  }
}
