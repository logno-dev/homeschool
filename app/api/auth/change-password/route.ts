import { NextRequest, NextResponse } from 'next/server'
import { getCurrentAuthSession } from '@/lib/auth-server'
import { changePasswordForUser } from '@/lib/auth-server'

export async function POST(request: NextRequest) {
  try {
    const session = await getCurrentAuthSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { currentPassword, newPassword } = await request.json()
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Current password and new password are required' }, { status: 400 })
    }

    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 })
    }

    const result = await changePasswordForUser({
      userId: session.user.id,
      currentPassword,
      nextPassword: newPassword
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ message: 'Password updated. Please sign in again.' })
  } catch (error) {
    console.error('Error changing password:', error)
    return NextResponse.json({ error: 'Failed to change password' }, { status: 500 })
  }
}
