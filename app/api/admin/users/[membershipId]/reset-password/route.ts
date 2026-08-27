import { NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { resetPasswordByAdmin } from '@/lib/auth-server'

export async function POST(_request: Request, { params }: { params: Promise<{ membershipId: string }> }) {
  const auth = await getAuthenticatedAdmin('users')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { membershipId } = await params
  const temporaryPassword = await resetPasswordByAdmin(membershipId)
  if (!temporaryPassword) return NextResponse.json({ error: 'Active account not found' }, { status: 404 })
  return NextResponse.json({ temporaryPassword })
}
