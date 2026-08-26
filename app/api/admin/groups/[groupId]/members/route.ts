import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { userGroupMemberships, userGroups, users } from '@/lib/schema'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin('groups')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const { groupId } = await params
    const { userId } = await request.json()
    const [group] = await db.select().from(userGroups).where(eq(userGroups.id, groupId)).limit(1)
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1)
    if (!group || !user) return NextResponse.json({ error: 'Group or user not found' }, { status: 404 })
    await db.insert(userGroupMemberships).values({ id: randomUUID(), userId, groupId }).onConflictDoNothing()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error adding group member:', error)
    return NextResponse.json({ error: 'Failed to add group member' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin('groups')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const { groupId } = await params
    const userId = new URL(request.url).searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'User id is required' }, { status: 400 })
    await db.delete(userGroupMemberships).where(and(eq(userGroupMemberships.groupId, groupId), eq(userGroupMemberships.userId, userId)))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing group member:', error)
    return NextResponse.json({ error: 'Failed to remove group member' }, { status: 500 })
  }
}
