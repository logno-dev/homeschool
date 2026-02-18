import { NextResponse } from 'next/server'
import { getCurrentAuthSession } from '@/lib/auth-server'

export async function GET() {
  const session = await getCurrentAuthSession()

  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 })
  }

  return NextResponse.json({ user: session.user, role: session.role })
}
