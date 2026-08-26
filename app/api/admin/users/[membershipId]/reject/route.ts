import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { authAccounts, authSessions, users } from '@/lib/schema'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ membershipId: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin('users')
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { membershipId } = await params
    if (!membershipId) {
      return NextResponse.json({ error: 'User id is required' }, { status: 400 })
    }

    const now = new Date().toISOString()
    await db.update(users).set({ activationStatus: 'rejected', updatedAt: now }).where(eq(users.id, membershipId))
    await db.update(authAccounts).set({ isActive: false, updatedAt: now }).where(eq(authAccounts.userId, membershipId))
    await db.delete(authSessions).where(eq(authSessions.userId, membershipId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error rejecting user:', error)
    return NextResponse.json({ error: 'Failed to reject user' }, { status: 500 })
  }
}
