import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { sessions } from '@/lib/schema'

export async function GET(_request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    await getAuthenticatedUser()
    const { sessionId } = await params
    const [session] = await db.select({ updatedAt: sessions.updatedAt }).from(sessions).where(eq(sessions.id, sessionId)).limit(1)
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    return NextResponse.json({ updatedAt: session.updatedAt })
  } catch (error) {
    console.error('Error checking registration version:', error)
    return NextResponse.json({ error: 'Unable to check registration updates' }, { status: 500 })
  }
}
