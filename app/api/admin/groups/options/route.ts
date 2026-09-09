import { NextResponse } from 'next/server'
import { asc } from 'drizzle-orm'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { userGroups } from '@/lib/schema'

export async function GET() {
  const auth = await getAuthenticatedAdmin(['groups', 'sessions'])
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const groups = await db.select({ id: userGroups.id, name: userGroups.name, slug: userGroups.slug })
      .from(userGroups).orderBy(asc(userGroups.name))
    return NextResponse.json({ groups })
  } catch (error) {
    console.error('Error loading group options:', error)
    return NextResponse.json({ error: 'Failed to load group options' }, { status: 500 })
  }
}
