import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { asc, eq } from 'drizzle-orm'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { userGroupMemberships, userGroups, users } from '@/lib/schema'

const predefinedGroups = [
  { id: 'group-family', name: 'Family', slug: 'family', isSystem: true },
  { id: 'group-teacher', name: 'Teacher', slug: 'teacher', isSystem: true },
]

export async function GET() {
  try {
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

    // Keep the admin view usable if the table was migrated without its seed rows.
    await db.insert(userGroups).values(predefinedGroups).onConflictDoNothing()
    const groups = await db.select().from(userGroups).orderBy(asc(userGroups.name))
    const memberships = await db.select({ membership: userGroupMemberships, user: users }).from(userGroupMemberships).innerJoin(users, eq(userGroupMemberships.userId, users.id))
    return NextResponse.json({
      groups: groups.map((group) => ({
        ...group,
        members: memberships.filter(({ membership }) => membership.groupId === group.id).map(({ user }) => ({ id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName }))
      }))
    })
  } catch (error) {
    console.error('Error loading groups:', error)
    return NextResponse.json({ error: 'Failed to load groups' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const body = await request.json()
    const name = String(body.name || '').trim()
    const slug = String(body.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
    if (!name || !slug) return NextResponse.json({ error: 'Group name is required' }, { status: 400 })

    const [group] = await db.insert(userGroups).values({ id: randomUUID(), name, slug, isSystem: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).returning()
    return NextResponse.json({ group }, { status: 201 })
  } catch (error) {
    console.error('Error creating group:', error)
    return NextResponse.json({ error: 'Failed to create group' }, { status: 500 })
  }
}
