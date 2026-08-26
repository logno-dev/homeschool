import { NextResponse } from 'next/server'
import { getAuthenticatedUserSession } from '@/lib/server-auth'
import { getCurrentAuthSession } from '@/lib/auth-server'
import { clearSessionCookie, deleteAllUserSessions } from '@/lib/auth-server'
import { db } from '@/lib/db'
import { authAccounts, users } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { getHandbookSettings, hasCurrentAcknowledgement, recordAcknowledgement, type ReleaseChoice } from '@/lib/acknowledgements'

export async function GET() {
  const handbook = await getHandbookSettings()
  const session = await getCurrentAuthSession()
  const acknowledged = session ? await hasCurrentAcknowledgement(session.user.id) : false

  return NextResponse.json({
    handbookUrl: handbook.url,
    handbookVersion: handbook.version,
    acknowledged
  })
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedUserSession()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json()
    if (body.releaseLiabilityAgreed !== true || body.handbookAgreed !== true) {
      return NextResponse.json({ error: 'You must agree to the release of liability and handbook acknowledgement' }, { status: 400 })
    }

    if (!['agree', 'do_not_agree'].includes(body.contactInfoRelease) || !['agree', 'do_not_agree'].includes(body.photographyRelease)) {
      return NextResponse.json({ error: 'Please select an option for each contact and photography release' }, { status: 400 })
    }

    const handbook = await getHandbookSettings()
    if (!handbook.url || !handbook.version) {
      return NextResponse.json({ error: 'The current handbook has not been configured. Please contact an administrator.' }, { status: 503 })
    }

    await recordAcknowledgement({
      userId: auth.session.user.id,
      releaseLiabilityAgreed: true,
      contactInfoRelease: body.contactInfoRelease as ReleaseChoice,
      photographyRelease: body.photographyRelease as ReleaseChoice,
      handbookVersion: handbook.version
    })

    const [user] = await db.select({ activationStatus: users.activationStatus }).from(users).where(eq(users.id, auth.session.user.id)).limit(1)
    if (user?.activationStatus === 'parked') {
      const now = new Date().toISOString()
      await db.update(users).set({ activationStatus: 'pending', updatedAt: now }).where(eq(users.id, auth.session.user.id))
      await db.update(authAccounts).set({ isActive: false, updatedAt: now }).where(eq(authAccounts.userId, auth.session.user.id))
      await deleteAllUserSessions(auth.session.user.id)
      const response = NextResponse.json({ success: true, reactivationPending: true })
      clearSessionCookie(response)
      return response
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error recording acknowledgement:', error)
    return NextResponse.json({ error: 'Failed to save acknowledgement' }, { status: 500 })
  }
}
