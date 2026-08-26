import { NextResponse } from 'next/server'
import { getAuthenticatedUserSession } from '@/lib/server-auth'
import { getRegistrationAccess } from '@/lib/user-groups'

export async function GET(_request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const auth = await getAuthenticatedUserSession()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { sessionId } = await params
  const access = await getRegistrationAccess(sessionId, auth.session.user.id)
  return NextResponse.json({ isOpen: access.isOpen, reason: access.reason })
}
