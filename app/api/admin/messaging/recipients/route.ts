import { NextResponse } from 'next/server'
import { asc } from 'drizzle-orm'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { users, userGroups, userGroupMemberships } from '@/lib/schema'

export async function GET() {
  const auth = await getAuthenticatedAdmin('newsletters')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const [recipients, groups, memberships] = await Promise.all([
      db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email }).from(users).orderBy(asc(users.lastName)),
      db.select({ id: userGroups.id, name: userGroups.name, isSystem: userGroups.isSystem }).from(userGroups).orderBy(asc(userGroups.name)),
      db.select({ groupId: userGroupMemberships.groupId, userId: userGroupMemberships.userId }).from(userGroupMemberships),
    ])
    return NextResponse.json({
      users: recipients,
      groups: groups.map(group => ({ ...group, members: memberships.filter(member => member.groupId === group.id).map(member => ({ id: member.userId })) })),
    })
  } catch (error) {
    console.error('Error loading message recipients:', error)
    return NextResponse.json({ error: 'Failed to load message recipients' }, { status: 500 })
  }
}
