import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { authAccounts, users } from '@/lib/schema'
import { sendAccountApprovedEmail } from '@/lib/email'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ membershipId: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin('users')
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { membershipId } = await params
    if (!membershipId) {
      return NextResponse.json({ error: 'User id is required' }, { status: 400 })
    }

    const [user] = await db.select().from(users).where(eq(users.id, membershipId)).limit(1)
    const [account] = await db.select().from(authAccounts).where(eq(authAccounts.userId, membershipId)).limit(1)
    if (!user || !account) {
      return NextResponse.json({ error: 'User account not found' }, { status: 404 })
    }

    const now = new Date().toISOString()
    await db.update(users).set({ activationStatus: 'active', updatedAt: now }).where(eq(users.id, membershipId))
    await db.update(authAccounts).set({ isActive: true, updatedAt: now }).where(eq(authAccounts.userId, membershipId))

    try {
      await sendAccountApprovedEmail({ to: account.email, firstName: user.firstName })
    } catch (emailError) {
      console.error('Unable to send account approval email:', emailError)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error approving user:', error)
    return NextResponse.json({ error: 'Failed to approve user' }, { status: 500 })
  }
}
