import { randomUUID } from 'crypto'
import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { classHubMessages, classHubThreads } from '@/lib/schema'
import { getAuthenticatedUserSession } from '@/lib/server-auth'
import { getClassHubAccess } from '@/lib/class-hub-access'
import { cleanClassHubText } from '@/lib/class-hub-content'

export async function POST(request: Request, { params }: { params: Promise<{ scheduleId: string; threadId: string }> }) {
  const auth = await getAuthenticatedUserSession()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { scheduleId, threadId } = await params
  const access = await getClassHubAccess(auth.session.user.id, scheduleId)
  if (!access?.canView) return NextResponse.json({ error: 'You do not have access to this class' }, { status: 403 })
  const [thread] = await db.select().from(classHubThreads).where(and(eq(classHubThreads.id, threadId), eq(classHubThreads.scheduleId, scheduleId))).limit(1)
  if (!thread || (!access.canManage && thread.familyId !== access.familyId)) return NextResponse.json({ error: 'Question not found' }, { status: 404 })
  const body = cleanClassHubText((await request.json()).body, 5000)
  if (!body) return NextResponse.json({ error: 'Enter a reply' }, { status: 400 })
  const now = new Date().toISOString()
  const [message] = await db.insert(classHubMessages).values({ id: randomUUID(), threadId, authorUserId: auth.session.user.id, body, createdAt: now, updatedAt: now }).returning()
  await db.update(classHubThreads).set({ status: 'open', updatedAt: now }).where(eq(classHubThreads.id, threadId))
  return NextResponse.json({ message }, { status: 201 })
}
