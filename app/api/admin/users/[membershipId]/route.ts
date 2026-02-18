import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { authAccounts, authSessions } from '@/lib/schema'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ membershipId: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { membershipId } = await params
    if (!membershipId) {
      return NextResponse.json({ error: 'User id is required' }, { status: 400 })
    }

    await db
      .update(authAccounts)
      .set({ isActive: false, updatedAt: new Date().toISOString() })
      .where(eq(authAccounts.userId, membershipId))

    await db.delete(authSessions).where(eq(authSessions.userId, membershipId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deactivating user:', error)
    return NextResponse.json({ error: 'Failed to deactivate user' }, { status: 500 })
  }
}
