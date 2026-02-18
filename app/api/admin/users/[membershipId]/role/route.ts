import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { guardians, users } from '@/lib/schema'

const ALLOWED_ROLES = new Set(['user', 'staff', 'moderator', 'admin'])

function normalizeRole(input: string) {
  if (input === 'org-user') return 'user'
  if (input === 'org-staff') return 'staff'
  if (input === 'org-admin') return 'admin'
  return input
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ membershipId: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { membershipId } = await params
    const body = await request.json()
    const role = normalizeRole(String(body?.role || ''))

    if (!membershipId || !ALLOWED_ROLES.has(role)) {
      return NextResponse.json({ error: 'Valid user id and role are required' }, { status: 400 })
    }

    const normalizedRole = role === 'staff' ? 'moderator' : role
    await db.update(users).set({ role: normalizedRole, updatedAt: new Date().toISOString() }).where(eq(users.id, membershipId))
    await db.update(guardians).set({ role: normalizedRole, updatedAt: new Date().toISOString() }).where(eq(guardians.id, membershipId))

    return NextResponse.json({ success: true, role: normalizedRole })
  } catch (error) {
    console.error('Error updating role:', error)
    return NextResponse.json({ error: 'Failed to update role' }, { status: 500 })
  }
}
