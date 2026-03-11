import { NextRequest, NextResponse } from 'next/server'
import { createPasswordResetToken } from '@/lib/auth-server'
import { sendPasswordResetEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''

    if (!normalizedEmail) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const token = await createPasswordResetToken(normalizedEmail)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const resetUrl = token && process.env.NODE_ENV !== 'production'
      ? `${appUrl}/reset-password?token=${token}`
      : null

    if (token) {
      const emailResetUrl = `${appUrl}/reset-password?token=${token}`
      try {
        await sendPasswordResetEmail({ to: normalizedEmail, resetUrl: emailResetUrl })
      } catch (sendError) {
        console.error('Error sending password reset email:', sendError)
        return NextResponse.json({ error: 'Failed to process request' }, { status: 500 })
      }
    }

    return NextResponse.json({
      message: 'If an account exists for that email, a reset link has been sent.',
      resetUrl
    })
  } catch (error) {
    console.error('Error creating password reset token:', error)
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 })
  }
}
