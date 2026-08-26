import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq, inArray } from 'drizzle-orm'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { sessionRegistrationWindows, sessions, userGroups } from '@/lib/schema'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin('sessions')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const { sessionId } = await params
    const windows = await db.select({ window: sessionRegistrationWindows, group: userGroups }).from(sessionRegistrationWindows).innerJoin(userGroups, eq(sessionRegistrationWindows.groupId, userGroups.id)).where(eq(sessionRegistrationWindows.sessionId, sessionId))
    return NextResponse.json({ windows: windows.map(({ window, group }) => ({ ...window, group })) })
  } catch (error) {
    console.error('Error loading registration windows:', error)
    return NextResponse.json({ error: 'Failed to load registration windows' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin('sessions')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const { sessionId } = await params
    const body = await request.json()
    const windows = Array.isArray(body.windows) ? body.windows : []
    const groupIds = windows.map((window: { groupId: string }) => window.groupId).filter(Boolean)
    const groups = groupIds.length ? await db.select({ id: userGroups.id }).from(userGroups).where(inArray(userGroups.id, groupIds)) : []
    if (groups.length !== new Set(groupIds).size) return NextResponse.json({ error: 'Every registration window must use a valid group' }, { status: 400 })
    if (windows.some((window: { startDate: string; endDate: string }) => !window.startDate || !window.endDate || new Date(window.startDate) > new Date(window.endDate))) {
      return NextResponse.json({ error: 'Registration windows must have valid start and end dates' }, { status: 400 })
    }

    const [session] = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.id, sessionId)).limit(1)
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    await db.transaction(async (tx) => {
      await tx.delete(sessionRegistrationWindows).where(eq(sessionRegistrationWindows.sessionId, sessionId))
      if (windows.length) {
        await tx.insert(sessionRegistrationWindows).values(windows.map((window: { groupId: string; startDate: string; endDate: string }) => ({
          id: randomUUID(), sessionId, groupId: window.groupId, startDate: window.startDate, endDate: window.endDate,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        })))
      }
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving registration windows:', error)
    return NextResponse.json({ error: 'Failed to save registration windows' }, { status: 500 })
  }
}
