import { NextResponse } from 'next/server'
import { getAuthenticatedUserSession } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { families, guardians, children } from '@/lib/schema'
import { eq } from 'drizzle-orm'

export async function GET() {
  try {
    const auth = await getAuthenticatedUserSession()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { session: authSession } = auth

    // Get current guardian to find family ID
    const currentGuardian = await db.select().from(guardians).where(eq(guardians.id, authSession.user.id)).limit(1)

    if (!currentGuardian[0]) {
      return NextResponse.json(
        { error: 'No family found' },
        { status: 404 }
      )
    }

    const familyId = currentGuardian[0].familyId

    // Get all family data in parallel
    const [family, allGuardians, allChildren] = await Promise.all([
      db.select().from(families).where(eq(families.id, familyId)).limit(1),
      db.select().from(guardians).where(eq(guardians.familyId, familyId)),
      db.select().from(children).where(eq(children.familyId, familyId))
    ])

    if (!family[0]) {
      return NextResponse.json(
        { error: 'Family not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      family: family[0],
      guardians: allGuardians,
      children: allChildren
    })
  } catch (error) {
    console.error('Error fetching family profile:', error)
    return NextResponse.json(
      { error: 'Failed to fetch family profile' },
      { status: 500 }
    )
  }
}