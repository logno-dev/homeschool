import { NextResponse } from 'next/server'
import { getAuthenticatedUserSession } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { families, children } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { getGuardianById, getGuardiansByFamily } from '@/lib/database'

export async function GET() {
  try {
    const auth = await getAuthenticatedUserSession()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { session: authSession } = auth

    // Get current guardian to find family ID
    const currentGuardian = await getGuardianById(authSession.user.id)

    if (!currentGuardian) {
      return NextResponse.json(
        { error: 'No family found' },
        { status: 404 }
      )
    }

    const familyId = currentGuardian.familyId

    // Get all family data in parallel
    const [family, allGuardians, allChildren] = await Promise.all([
      db.select().from(families).where(eq(families.id, familyId)).limit(1),
      getGuardiansByFamily(familyId),
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

export async function PATCH(request: Request) {
  try {
    const auth = await getAuthenticatedUserSession()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { session: authSession } = auth

    const currentGuardian = await getGuardianById(authSession.user.id)
    if (!currentGuardian) {
      return NextResponse.json({ error: 'No family found' }, { status: 404 })
    }

    const { name, address, phone, email } = await request.json()

    if (!name || !address || !phone || !email) {
      return NextResponse.json({ error: 'Name, address, phone, and email are required' }, { status: 400 })
    }

    const updatedAt = new Date().toISOString()
    const updatedFamily = await db
      .update(families)
      .set({
        name: name.trim(),
        address: address.trim(),
        phone: phone.trim(),
        email: email.trim(),
        updatedAt
      })
      .where(eq(families.id, currentGuardian.familyId))
      .returning()

    if (!updatedFamily[0]) {
      return NextResponse.json({ error: 'Family not found' }, { status: 404 })
    }

    return NextResponse.json({ family: updatedFamily[0] })
  } catch (error) {
    console.error('Error updating family profile:', error)
    return NextResponse.json({ error: 'Failed to update family profile' }, { status: 500 })
  }
}
