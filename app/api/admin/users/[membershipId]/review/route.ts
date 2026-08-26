import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { users } from '@/lib/schema'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ membershipId: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { membershipId } = await params
    if (!membershipId) {
      return NextResponse.json({ error: 'User id is required' }, { status: 400 })
    }

    await db.update(users)
      .set({ activationStatus: 'under_review', updatedAt: new Date().toISOString() })
      .where(eq(users.id, membershipId))

    return NextResponse.json({ success: true, status: 'under_review' })
  } catch (error) {
    console.error('Error marking user under review:', error)
    return NextResponse.json({ error: 'Failed to review user' }, { status: 500 })
  }
}
