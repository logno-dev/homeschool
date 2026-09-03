import { NextResponse } from 'next/server'
import { getAuthenticatedUserSession } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { guardians, users } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { getGuardianById } from '@/lib/database'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ guardianId: string }> }
) {
  try {
    const auth = await getAuthenticatedUserSession()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const currentGuardian = await getGuardianById(auth.session.user.id)
    const { guardianId } = await params
    const targetGuardian = await getGuardianById(guardianId)
    if (!currentGuardian || !targetGuardian || currentGuardian.familyId !== targetGuardian.familyId) {
      return NextResponse.json({ error: 'Guardian not found' }, { status: 404 })
    }
    if (!currentGuardian.isMainContact) return NextResponse.json({ error: 'Only the family creator can remove guardians' }, { status: 403 })
    if (targetGuardian.isMainContact || targetGuardian.id === currentGuardian.id) return NextResponse.json({ error: 'The family creator cannot be removed' }, { status: 400 })

    await db.delete(guardians).where(eq(guardians.id, targetGuardian.id))
    await db.delete(users).where(eq(users.id, targetGuardian.id))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing family guardian:', error)
    return NextResponse.json({ error: 'Failed to remove guardian' }, { status: 500 })
  }
}
