import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { userGroups } from '@/lib/schema'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const { groupId } = await params
    const [group] = await db.select().from(userGroups).where(eq(userGroups.id, groupId)).limit(1)
    if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    if (group.isSystem) return NextResponse.json({ error: 'System groups cannot be deleted' }, { status: 400 })
    await db.delete(userGroups).where(eq(userGroups.id, groupId))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting group:', error)
    return NextResponse.json({ error: 'Failed to delete group' }, { status: 500 })
  }
}
