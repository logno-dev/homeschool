import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { authAccounts, authSessions, userGroupMemberships, userGroups, users } from '@/lib/schema'
import { createSessionForUser } from '@/lib/auth-server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ membershipId: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin('users')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const { membershipId } = await params
    const [user] = await db.select().from(users).where(eq(users.id, membershipId)).limit(1)
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const [account] = await db.select().from(authAccounts).where(eq(authAccounts.userId, membershipId)).limit(1)
    const memberships = await db
      .select({ group: userGroups })
      .from(userGroupMemberships)
      .innerJoin(userGroups, eq(userGroupMemberships.groupId, userGroups.id))
      .where(eq(userGroupMemberships.userId, membershipId))
    const groups = await db.select().from(userGroups)

    return NextResponse.json({
      user: { ...user, email: account?.email || user.email, status: account?.isActive ? 'active' : 'inactive' },
      groups,
      memberships: memberships.map(({ group }) => group.id)
    })
  } catch (error) {
    console.error('Error loading user details:', error)
    return NextResponse.json({ error: 'Failed to load user details' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ membershipId: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin('users')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const { membershipId } = await params
    const [target] = await db.select({ id: users.id }).from(users).where(eq(users.id, membershipId)).limit(1)
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    const { token } = await createSessionForUser(membershipId, 1 / 24)
    return NextResponse.json({ url: `/emulate?token=${encodeURIComponent(token)}` })
  } catch (error) {
    console.error('Error creating emulation session:', error)
    return NextResponse.json({ error: 'Failed to emulate user' }, { status: 500 })
  }
}

export async function DELETE(
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

    await db
      .update(authAccounts)
      .set({ isActive: false, updatedAt: new Date().toISOString() })
      .where(eq(authAccounts.userId, membershipId))

    await db
      .update(users)
      .set({ activationStatus: 'parked', updatedAt: new Date().toISOString() })
      .where(eq(users.id, membershipId))

    await db.delete(authSessions).where(eq(authSessions.userId, membershipId))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deactivating user:', error)
    return NextResponse.json({ error: 'Failed to deactivate user' }, { status: 500 })
  }
}
